// per-instance lifecycle notifications shared by dialogs and their content
export const DIALOG_LIFECYCLE_EVENTS = {
  open: 'website-ui:dialog-open',
  dismiss: 'website-ui:dialog-dismiss',
} as const;
