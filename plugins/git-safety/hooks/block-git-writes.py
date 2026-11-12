#!/usr/bin/env python3
import json
import os
import re
import shlex
import sys

BLOCKED = {"commit", "push"}
GIT_OPTS_WITH_ARG = {"-C", "-c", "--git-dir", "--work-tree", "--namespace", "--config-env"}
SHELLS = {"sh", "bash", "zsh", "dash"}
FALLBACK = re.compile(r"\bgit\b(?:\s+-{1,2}\S+(?:\s+\S+)?)*?\s+(commit|push)\b")


def tokenize(cmd):
    lex = shlex.shlex(cmd, posix=True, punctuation_chars=True)
    lex.whitespace_split = True
    return [t.strip("`") for t in lex]


def git_subcommand(toks, i):
    j = i + 1
    while j < len(toks):
        if toks[j] in GIT_OPTS_WITH_ARG:
            j += 2
        elif toks[j].startswith("-"):
            j += 1
        else:
            return toks[j]
    return None


def offending(cmd):
    try:
        toks = tokenize(cmd)
    except ValueError:
        match = FALLBACK.search(cmd)
        return match.group(1) if match else None

    for i, tok in enumerate(toks):
        name = os.path.basename(tok)
        if name == "git" and (sub := git_subcommand(toks, i)) in BLOCKED:
            return sub
        prev = os.path.basename(toks[i - 1]) if i else ""
        if prev in SHELLS and re.fullmatch(r"-\w*c\w*", tok) and i + 1 < len(toks):
            if sub := offending(toks[i + 1]):
                return sub
        if name == "eval" and (sub := offending(" ".join(toks[i + 1:]))):
            return sub
    return None


def main():
    cmd = json.load(sys.stdin).get("tool_input", {}).get("command", "")
    if sub := offending(cmd):
        print(
            f"Blocked by the git-safety plugin: `git {sub}` is reserved for the user. "
            "Prepare the `git add <files>` command and a commit message "
            "and hand them over instead.",
            file=sys.stderr,
        )
        sys.exit(2)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"block-git-writes.py failed ({error!r}); blocking to be safe.", file=sys.stderr)
        sys.exit(2)
