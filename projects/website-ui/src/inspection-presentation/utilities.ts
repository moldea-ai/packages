import {
  DIAGNOSTIC_GROUP_PRESENTATIONS,
  FINDING_CATEGORY_PRESENTATIONS,
  INSPECTION_IMPACT_PRESENTATIONS,
  INSPECTION_METADATA_ICONS,
  INSPECTION_RELATIONSHIP_PRESENTATIONS,
} from './constants.js';
import type { IInspectionFindingView, IInspectionPresentation } from './types.js';

/** Resolves impact independently of a finding's subject and original severity. */
export const getInspectionImpact = (finding: IInspectionFindingView) =>
  INSPECTION_IMPACT_PRESENTATIONS[
    finding.severity === 'warning' && finding.accepted ? 'accepted' : finding.severity
  ];

/** Selects the platform subject without guessing a category for unsupported Core groups. */
export const getInspectionPresentation = (
  finding: IInspectionFindingView,
): IInspectionPresentation =>
  finding.kind === 'structural'
    ? DIAGNOSTIC_GROUP_PRESENTATIONS[finding.group]
    : FINDING_CATEGORY_PRESENTATIONS[finding.category];

/** Names captured relationships with the platform's exact icons and labels. */
export const getInspectionRelationship = (relationship: string): IInspectionPresentation =>
  Object.hasOwn(INSPECTION_RELATIONSHIP_PRESENTATIONS, relationship)
    ? INSPECTION_RELATIONSHIP_PRESENTATIONS[relationship]!
    : {
        label: relationship.replaceAll('-', ' ').replace(/^./u, (letter) => letter.toUpperCase()),
        icon: INSPECTION_METADATA_ICONS.file,
      };

/** Groups visible findings without changing record order or the accepted-warning collection. */
export const groupInspectionFindings = (findings: IInspectionFindingView[]) => {
  const groups = new Map<
    string,
    { key: string; label: string; findings: IInspectionFindingView[] }
  >();
  const accepted: IInspectionFindingView[] = [];
  for (const finding of findings) {
    if (finding.severity === 'warning' && finding.accepted) {
      accepted.push(finding);
      continue;
    }
    const subject = getInspectionPresentation(finding);
    const key = `${finding.severity}:${finding.kind === 'structural' ? finding.group : finding.category}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        label: `${subject.label} ${finding.severity === 'error' ? 'errors' : 'warnings'}`,
        findings: [],
      };
      groups.set(key, group);
    }
    group.findings.push(finding);
  }
  return {
    groups: [...groups.values()].sort(
      (left, right) =>
        Number(right.key.startsWith('error:')) - Number(left.key.startsWith('error:')),
    ),
    accepted,
  };
};
