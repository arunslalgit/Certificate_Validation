#!/usr/bin/env bash
set -euo pipefail

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: go_to_branch.sh must be run inside a Git repository." >&2
  exit 1
fi

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <branch-name>" >&2
  exit 1
fi

branch_name="$1"

if git show-ref --verify --quiet "refs/heads/${branch_name}"; then
  git checkout "$branch_name"
  exit 0
fi

if git show-ref --verify --quiet "refs/remotes/origin/${branch_name}"; then
  git checkout -t "origin/${branch_name}"
  exit 0
fi

echo "Error: Branch '${branch_name}' does not exist locally or on origin." >&2
exit 2
