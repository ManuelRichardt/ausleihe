const ROLE_SCOPE = Object.freeze({
  GLOBAL: 'global',
  LENDING_LOCATION: 'ausleihe',
  BOTH: 'both',
});

const TRACKING_TYPE = Object.freeze({
  SERIALIZED: 'serialized',
  BULK: 'bulk',
  BUNDLE: 'bundle',
});

const LOAN_STATUS = Object.freeze({
  RESERVED: 'reserved',
  CANCELLED: 'cancelled',
  HANDED_OVER: 'handed_over',
  RETURNED: 'returned',
  OVERDUE: 'overdue',
});

const LOAN_ITEM_STATUS = Object.freeze({
  RESERVED: 'reserved',
  HANDED_OVER: 'handed_over',
  RETURNED: 'returned',
  LOST: 'lost',
  DAMAGED: 'damaged',
});

const LOAN_ITEM_TYPE = Object.freeze({
  SERIALIZED: 'serialized',
  BULK: 'bulk',
  BUNDLE_ROOT: 'bundle_root',
  BUNDLE_COMPONENT: 'bundle_component',
});

const LOAN_EVENT_TYPE = Object.freeze({
  RESERVED: 'reserved',
  CANCELLED: 'cancelled',
  HANDED_OVER: 'handed_over',
  RETURNED: 'returned',
  OVERDUE: 'overdue',
});

const ASSET_CONDITION = Object.freeze({
  NEW: 'new',
  GOOD: 'good',
  FAIR: 'fair',
  DAMAGED: 'damaged',
  LOST: 'lost',
});

const BOOLEAN_TRUE_TOKENS = Object.freeze(['true', '1', 'yes', 'ja', 'active']);
const BOOLEAN_FALSE_TOKENS = Object.freeze(['false', '0', 'no', 'nein', 'inactive']);
const ACTIVE_STATUS_LABEL = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
});

const PRIVACY_REQUEST_STATUS = Object.freeze({
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
});

const PRIVACY_AUDIT_ACTION = Object.freeze({
  DELETION_REQUEST_CREATED: 'privacy.deletion_request.created',
  DELETION_REQUEST_REJECTED: 'privacy.deletion_request.rejected',
  USER_DELETED: 'privacy.user_deleted',
});

module.exports = {
  ROLE_SCOPE,
  TRACKING_TYPE,
  LOAN_STATUS,
  LOAN_ITEM_STATUS,
  LOAN_ITEM_TYPE,
  LOAN_EVENT_TYPE,
  ASSET_CONDITION,
  BOOLEAN_TRUE_TOKENS,
  BOOLEAN_FALSE_TOKENS,
  ACTIVE_STATUS_LABEL,
  PRIVACY_REQUEST_STATUS,
  PRIVACY_AUDIT_ACTION,
};
