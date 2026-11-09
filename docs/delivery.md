# Delivery

Default stop: **development**. Ordered stops: **development → main**.

## development

Operator: agent.

Run the applicable [local development](local-development.md) and [testing](testing.md) gates, review and commit the task's source, integrate it into development and push. Verify that the live origin/development contains the task commit.

## main

Operator: agent.

Follow [npm releases](npm-releases.md): qualify the selected versions and immutable consumer artifacts, merge checked development into main, and verify the release orchestrator's actual publication. Follow the same guide and the [packages website procedure](../apps/website/README.md) for its subsequent Pages delivery. Existing release-scope verification and registry-recovery preconditions apply.

## Evidence and cleanup

Report live branch/HEAD, committed source, remote containment and the reached stop. For main, include the verified package versions, qualified artifact/source identities and website deployment revision. Remove only this task's clean, integrated, inactive worktree, local/remote task branches and disposable temporary folders. Preserve release evidence and every other owner's work.
