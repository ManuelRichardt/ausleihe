const apiBase = '/api/v1';
const openapiVersion = '3.1.0';

const tags = [
  { name: 'Users' },
  { name: 'Roles' },
  { name: 'Permissions' },
  { name: 'Authz' },
  { name: 'LendingLocations' },
  { name: 'OpeningHours' },
  { name: 'OpeningExceptions' },
  { name: 'Manufacturers' },
  { name: 'AssetCategories' },
  { name: 'AssetModels' },
  { name: 'Assets' },
  { name: 'StorageLocations' },
  { name: 'AssetAttachments' },
  { name: 'AssetMaintenance' },
  { name: 'CustomFieldDefinitions' },
  { name: 'CustomFieldValues' },
  { name: 'Loans' },
  { name: 'LoanItems' },
  { name: 'LoanSignatures' },
  { name: 'LoanEvents' },
  { name: 'AuditLogs' },
];

module.exports = {
  apiBase,
  openapiVersion,
  tags,
};
