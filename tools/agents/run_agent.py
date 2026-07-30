"""
Headless runner for this project's record agents, built on the Claude Agent SDK.

Same three agents you get inside Claude Code -- but runnable from a terminal, a
pre-commit hook, or a scheduled job, with no interactive session.

    python tools/agents/run_agent.py audit
    python tools/agents/run_agent.py review public/records/REC-7.9.1-chiller-temperature-monitoring.html
    python tools/agents/run_agent.py digitize "REC 7.1.2 Abalone Receiving.docx"

    python tools/agents/run_agent.py audit --apply     # let it write fixes
    python tools/agents/run_agent.py review --json      # machine-readable, for CI

The agent instructions are NOT duplicated here. Each task reads its prompt out
of the matching `.claude/agents/<name>.md` -- the same file Claude Code loads --
so there is exactly one place to edit a rule. Editing the .md changes both
surfaces at once.

Setup:
    python -m venv .venv && .venv\\Scripts\\activate
    pip install claude-agent-sdk
    # auth: `ant auth login`, or set ANTHROPIC_API_KEY

Requires the `claude` CLI on PATH (the SDK drives it) and Python 3.10+.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from dataclasses import dataclass
from pathlib import Path

from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    ResultMessage,
    TextBlock,
    query,
)

REPO = Path(__file__).resolve().parents[2]
AGENT_DIR = REPO / ".claude" / "agents"

# Read-only tool set. Bash is included because the audit genuinely needs to run
# tools/sync-record-revisions.py against the Master Index List spreadsheet.
READ_ONLY_TOOLS = ["Read", "Grep", "Glob", "Bash"]
WRITE_TOOLS = READ_ONLY_TOOLS + ["Write", "Edit"]


@dataclass
class Task:
    """One runnable task: which agent .md to load, and how to prompt it."""

    agent: str          # basename of the .claude/agents/<name>.md to use
    build_prompt: object  # (argparse.Namespace) -> str
    writes: bool        # True if the task is allowed to modify the repo
    max_turns: int


def load_agent_prompt(name: str) -> str:
    """Return the body of .claude/agents/<name>.md, frontmatter stripped.

    Hand-parsed rather than via PyYAML: the frontmatter is a handful of flat
    `key: value` lines and this script should not need a dependency that
    tools/*.py does not already have.
    """
    path = AGENT_DIR / f"{name}.md"
    if not path.exists():
        sys.exit(f"No agent definition at {path}")

    text = path.read_text(encoding="utf-8")
    if not text.startswith("---"):
        return text.strip()

    # Split off the frontmatter block: --- ... --- then the body.
    parts = text.split("---", 2)
    if len(parts) < 3:
        return text.strip()
    return parts[2].strip()


def audit_prompt(args: argparse.Namespace) -> str:
    mode = (
        "Apply the corrections as well, then re-run the dry run to prove it "
        "comes back clean."
        if args.apply
        else "Report only -- do not modify any file."
    )
    return (
        "Audit every record page under public/records/ against the controlled "
        f"Master Index List. {mode}\n\n"
        "End your output with a summary line of the form:\n"
        "SUMMARY: <n> pages checked, <n> drifted, <n> expected-absent."
    )


def review_prompt(args: argparse.Namespace) -> str:
    if args.target:
        scope = f"Review this record page: {args.target}"
    else:
        scope = (
            "Review the record pages changed on this branch. Get the list with "
            "`git diff --name-only main...HEAD -- public/`; if that is empty, "
            "use `git status --porcelain`. If nothing under public/ has "
            "changed, say so and stop."
        )
    return (
        f"{scope}\n\n"
        "You cannot open a browser in this run, so skip the browser "
        "verification step and say which findings that leaves unverified.\n\n"
        "End your output with a summary line of the form:\n"
        "SUMMARY: <n> blocking, <n> non-blocking."
    )


def digitize_prompt(args: argparse.Namespace) -> str:
    if not args.target:
        sys.exit("digitize needs a source filename, e.g. \"REC 7.1.2 Abalone Receiving.docx\"")
    return (
        f"Digitize this source document: {args.target}\n\n"
        "You cannot open a browser in this run, so build and wire the page, "
        "then state explicitly that in-browser verification (console errors, "
        "save round-trip, header colour) is still outstanding and must be done "
        "before commit. Do not claim the record is finished."
    )


TASKS: dict[str, Task] = {
    "audit": Task("revision-auditor", audit_prompt, writes=False, max_turns=60),
    "review": Task("record-reviewer", review_prompt, writes=False, max_turns=60),
    "digitize": Task("record-digitizer", digitize_prompt, writes=True, max_turns=120),
}


async def run(task_name: str, args: argparse.Namespace) -> int:
    task = TASKS[task_name]
    writes = task.writes or getattr(args, "apply", False)

    options = ClaudeAgentOptions(
        system_prompt=load_agent_prompt(task.agent),
        cwd=str(REPO),
        model=args.model,
        allowed_tools=WRITE_TOOLS if writes else READ_ONLY_TOOLS,
        # "dontAsk" denies anything not pre-approved, which is what a headless
        # run wants: no prompt can be answered, so an unlisted tool must fail
        # loudly rather than hang.
        permission_mode="acceptEdits" if writes else "dontAsk",
        max_turns=task.max_turns,
        # Load .claude/settings.json so project permissions apply, but not the
        # user's personal settings -- a CI box has none, and a local run should
        # not behave differently from CI.
        setting_sources=["project"],
    )

    chunks: list[str] = []
    result: ResultMessage | None = None

    async for message in query(prompt=task.build_prompt(args), options=options):
        if isinstance(message, AssistantMessage):
            for block in message.content:
                if isinstance(block, TextBlock):
                    chunks.append(block.text)
                    if not args.json:
                        print(block.text, end="", flush=True)
        elif isinstance(message, ResultMessage):
            result = message

    transcript = "".join(chunks)
    ok = result is not None and result.subtype == "success"

    if args.json:
        summary = next(
            (
                line.strip()
                for line in reversed(transcript.splitlines())
                if line.strip().startswith("SUMMARY:")
            ),
            "",
        )
        json.dump(
            {
                "task": task_name,
                "agent": task.agent,
                "ok": ok,
                "terminal_reason": getattr(result, "terminal_reason", None),
                "summary": summary,
                "report": transcript,
            },
            sys.stdout,
            indent=2,
        )
        print()
    else:
        print()
        if not ok:
            print(
                f"\n[run_agent] did not finish cleanly: "
                f"{getattr(result, 'terminal_reason', 'no result message')}",
                file=sys.stderr,
            )

    # Non-zero on an incomplete run so a hook or CI step fails loudly. A clean
    # run that *found* problems still exits 0 -- read the report for that.
    return 0 if ok else 1


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run a record agent headlessly against this repo."
    )
    parser.add_argument("task", choices=sorted(TASKS))
    parser.add_argument(
        "target",
        nargs="?",
        help="Page path (review) or source filename (digitize).",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Let a read-only task write its fixes (audit).",
    )
    parser.add_argument("--json", action="store_true", help="Emit JSON, for CI.")
    parser.add_argument("--model", default="claude-opus-5")
    args = parser.parse_args()

    return asyncio.run(run(args.task, args))


if __name__ == "__main__":
    raise SystemExit(main())
