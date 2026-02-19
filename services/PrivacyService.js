const fs = require('fs/promises');
const path = require('path');
const { Op } = require('sequelize');
const { buildListOptions } = require('./_serviceUtils');
const {
  LOAN_STATUS,
  PRIVACY_REQUEST_STATUS,
  PRIVACY_AUDIT_ACTION,
} = require('../constants/domain');

const EXTERNAL_AUTH_PROVIDERS = Object.freeze(['saml', 'ldap']);
const ACTIVE_LOAN_STATUSES = Object.freeze([
  LOAN_STATUS.RESERVED,
  LOAN_STATUS.HANDED_OVER,
  LOAN_STATUS.OVERDUE,
]);

class PrivacyService {
  constructor(models) {
    this.models = models;
    this.projectRoot = path.resolve(__dirname, '..');
    this.uploadRoot = path.resolve(this.projectRoot, 'uploads');
  }

  async getConfig(options = {}) {
    let config = await this.models.PrivacyConfig.findOne({
      order: [['createdAt', 'ASC']],
      transaction: options.transaction,
    });
    if (!config && options.createIfMissing !== false) {
      config = await this.models.PrivacyConfig.create(
        {
          isEnabled: true,
          returnedLoanRetentionMonths: 3,
          autoDeleteExternalUsers: true,
        },
        { transaction: options.transaction }
      );
    }
    return config;
  }

  async updateConfig(data = {}) {
    const config = await this.getConfig({ createIfMissing: true });
    const nextRetention = parseInt(data.returnedLoanRetentionMonths, 10);
    const updates = {
      isEnabled:
        data.isEnabled !== undefined
          ? Boolean(data.isEnabled)
          : config.isEnabled,
      autoDeleteExternalUsers:
        data.autoDeleteExternalUsers !== undefined
          ? Boolean(data.autoDeleteExternalUsers)
          : config.autoDeleteExternalUsers,
    };
    if (!Number.isNaN(nextRetention)) {
      if (nextRetention < 1 || nextRetention > 120) {
        throw new Error('Aufbewahrungsdauer muss zwischen 1 und 120 Monaten liegen.');
      }
      updates.returnedLoanRetentionMonths = nextRetention;
    }
    await config.update(updates);
    return config;
  }

  async listDeletionRequests(filter = {}, options = {}) {
    const where = {};
    if (filter.status) {
      where.status = filter.status;
    }

    const include = [
      { model: this.models.User, as: 'user', paranoid: false },
      { model: this.models.User, as: 'requestedBy', paranoid: false },
      { model: this.models.User, as: 'processedBy', paranoid: false },
    ];

    if (filter.query) {
      const q = `%${String(filter.query).toLowerCase()}%`;
      include[0].required = true;
      include[0].where = {
        [Op.or]: [
          this.models.sequelize.where(
            this.models.sequelize.fn('LOWER', this.models.sequelize.col('user.username')),
            { [Op.like]: q }
          ),
          this.models.sequelize.where(
            this.models.sequelize.fn('LOWER', this.models.sequelize.col('user.email')),
            { [Op.like]: q }
          ),
          this.models.sequelize.where(
            this.models.sequelize.fn('LOWER', this.models.sequelize.col('user.first_name')),
            { [Op.like]: q }
          ),
          this.models.sequelize.where(
            this.models.sequelize.fn('LOWER', this.models.sequelize.col('user.last_name')),
            { [Op.like]: q }
          ),
        ],
      };
    }

    return this.models.PrivacyDeletionRequest.findAndCountAll({
      where,
      include,
      ...buildListOptions(options),
    });
  }

  #buildPrivacyAuditContext(input = {}) {
    return {
      actorId: input.actorId || null,
      reason: input.reason || null,
      metadata: input.metadata || {},
    };
  }

  async #logPrivacyAudit(action, entity, entityId, auditContext, transaction) {
    if (!auditContext.actorId) {
      return;
    }
    await this.models.AuditLog.create(
      {
        userId: auditContext.actorId,
        action,
        entity,
        entityId,
        metadata: {
          ...(auditContext.metadata || {}),
          reason: auditContext.reason || undefined,
        },
      },
      { transaction }
    );
  }

  async createDeletionRequest(data = {}) {
    if (!data.userId) {
      throw new Error('Benutzer ist erforderlich.');
    }
    const user = await this.models.User.findByPk(data.userId, { paranoid: false });
    if (!user || user.deletedAt) {
      throw new Error('Benutzer nicht gefunden.');
    }
    const existingOpen = await this.models.PrivacyDeletionRequest.findOne({
      where: {
        userId: data.userId,
        status: { [Op.in]: [PRIVACY_REQUEST_STATUS.OPEN, PRIVACY_REQUEST_STATUS.IN_PROGRESS] },
      },
    });
    if (existingOpen) {
      throw new Error('Für diesen Benutzer existiert bereits eine offene Löschanfrage.');
    }
    const request = await this.models.PrivacyDeletionRequest.create({
      userId: data.userId,
      requestedByUserId: data.requestedByUserId || null,
      status: PRIVACY_REQUEST_STATUS.OPEN,
      requestNote: data.requestNote || null,
      metadata: data.metadata || null,
    });
    const privacyAuditContext = this.#buildPrivacyAuditContext({
      actorId: data.requestedByUserId || null,
      reason: 'deletion_request_created',
      metadata: { targetUserId: data.userId },
    });
    await this.#logPrivacyAudit(
      PRIVACY_AUDIT_ACTION.DELETION_REQUEST_CREATED,
      'PrivacyDeletionRequest',
      request.id,
      privacyAuditContext
    );
    return request;
  }

  async rejectDeletionRequest(id, data = {}) {
    const request = await this.models.PrivacyDeletionRequest.findByPk(id);
    if (!request) {
      throw new Error('Löschanfrage nicht gefunden.');
    }
    if ([PRIVACY_REQUEST_STATUS.COMPLETED, PRIVACY_REQUEST_STATUS.REJECTED].includes(request.status)) {
      throw new Error('Löschanfrage wurde bereits abgeschlossen.');
    }
    await request.update({
      status: PRIVACY_REQUEST_STATUS.REJECTED,
      processNote: data.processNote || null,
      processedByUserId: data.processedByUserId || null,
      processedAt: new Date(),
    });
    const privacyAuditContext = this.#buildPrivacyAuditContext({
      actorId: data.processedByUserId || null,
      reason: 'deletion_request_rejected',
      metadata: { targetUserId: request.userId },
    });
    await this.#logPrivacyAudit(
      PRIVACY_AUDIT_ACTION.DELETION_REQUEST_REJECTED,
      'PrivacyDeletionRequest',
      request.id,
      privacyAuditContext
    );
    return request;
  }

  async processDeletionRequest(id, data = {}) {
    const { sequelize } = this.models;
    const cleanupResult = await sequelize.transaction(async (transaction) => {
      const request = await this.models.PrivacyDeletionRequest.findByPk(id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!request) {
        throw new Error('Löschanfrage nicht gefunden.');
      }
      if (request.status === PRIVACY_REQUEST_STATUS.COMPLETED) {
        throw new Error('Löschanfrage wurde bereits verarbeitet.');
      }
      if (request.status === PRIVACY_REQUEST_STATUS.REJECTED) {
        throw new Error('Löschanfrage wurde abgelehnt.');
      }

      const activeLoanCount = await this.models.Loan.count({
        where: {
          userId: request.userId,
          status: { [Op.in]: ACTIVE_LOAN_STATUSES },
        },
        transaction,
      });
      if (activeLoanCount > 0) {
        throw new Error('Benutzer hat noch aktive Ausleihen oder Reservierungen.');
      }

      const privacyAuditContext = this.#buildPrivacyAuditContext({
        actorId: data.processedByUserId || null,
        reason: 'deletion_request',
        metadata: { targetUserId: request.userId },
      });
      const anonymizeResult = await this.anonymizeAndDeleteUser(
        request.userId,
        {
          transaction,
          auditContext: privacyAuditContext,
        }
      );

      await request.update(
        {
          status: PRIVACY_REQUEST_STATUS.COMPLETED,
          processNote: data.processNote || null,
          processedByUserId: data.processedByUserId || null,
          processedAt: new Date(),
        },
        { transaction }
      );

      return {
        request,
        filePaths: anonymizeResult.filePaths,
      };
    });

    // File deletions are intentionally outside DB transaction to avoid partial rollback on filesystem errors.
    await this.removeSignatureFiles(cleanupResult.filePaths);
    return cleanupResult.request;
  }

  async runAutomaticCleanup() {
    let config = null;
    try {
      config = await this.getConfig({ createIfMissing: true });
    } catch (err) {
      if (this.isMissingPrivacyTableError(err)) {
        return {
          skipped: true,
          reason: 'missing_privacy_tables',
        };
      }
      throw err;
    }
    if (!config || !config.isEnabled) {
      return {
        skipped: true,
        reason: 'disabled',
      };
    }

    const deletedLoansResult = await this.deleteReturnedLoansByRetention(config);
    let deletedExternalUsers = 0;
    if (config.autoDeleteExternalUsers) {
      const externalResult = await this.deleteStaleExternalUsers();
      deletedExternalUsers = externalResult.deletedUsers;
    }

    const summary = {
      deletedLoans: deletedLoansResult.deletedLoans,
      deletedLoanSignatures: deletedLoansResult.deletedSignatures,
      deletedExternalUsers,
      retentionMonths: config.returnedLoanRetentionMonths,
    };

    await config.update({
      lastRunAt: new Date(),
      lastRunSummary: summary,
    });

    return summary;
  }

  isMissingPrivacyTableError(err) {
    const message = (err && err.message ? String(err.message) : '').toLowerCase();
    return (
      message.includes('privacy_configs') ||
      message.includes('privacy_deletion_requests')
    );
  }

  async deleteReturnedLoansByRetention(config) {
    const retentionMonths = Math.max(parseInt(config.returnedLoanRetentionMonths || 3, 10), 1);
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - retentionMonths);

    const loans = await this.models.Loan.findAll({
      where: {
        status: LOAN_STATUS.RETURNED,
        returnedAt: { [Op.lte]: cutoff },
      },
      attributes: ['id'],
    });

    let deletedLoans = 0;
    let deletedSignatures = 0;
    const filesToDelete = [];

    for (const loan of loans) {
      const result = await this.purgeReturnedLoan(loan.id);

      deletedLoans += 1;
      deletedSignatures += result.deletedSignatures;
      filesToDelete.push(...result.filePaths);
    }

    await this.removeSignatureFiles(filesToDelete);

    return {
      deletedLoans,
      deletedSignatures,
      cutoff,
    };
  }

  async purgeReturnedLoan(loanId) {
    return this.models.sequelize.transaction(async (transaction) => {
      const signatures = await this.models.LoanSignature.findAll({
        where: { loanId },
        transaction,
      });
      const signatureIds = signatures.map((entry) => entry.id);
      const filePaths = signatures.map((entry) => entry.filePath).filter(Boolean);

      if (signatureIds.length) {
        await this.models.LoanSignature.destroy({
          where: { id: signatureIds },
          transaction,
        });
      }

      await this.models.LoanEvent.destroy({
        where: { loanId },
        transaction,
      });

      await this.models.LoanItem.destroy({
        where: {
          loanId,
          parentLoanItemId: { [Op.not]: null },
        },
        force: true,
        transaction,
      });
      await this.models.LoanItem.destroy({
        where: {
          loanId,
          parentLoanItemId: null,
        },
        force: true,
        transaction,
      });

      await this.models.Loan.destroy({
        where: { id: loanId },
        force: true,
        transaction,
      });

      return {
        deletedSignatures: signatureIds.length,
        filePaths,
      };
    });
  }

  async isEligibleForExternalCleanup(userId) {
    const { activeLoanCount, returnedLoanCount } = await this.#getLoanStateCountsForUser(userId);
    // Eligibility requires zero active and zero returned loans before anonymization.
    return activeLoanCount === 0 && returnedLoanCount === 0;
  }

  async deleteStaleExternalUsers() {
    const candidates = await this.models.User.findAll({
      where: {
        externalProvider: { [Op.in]: EXTERNAL_AUTH_PROVIDERS },
      },
      attributes: ['id'],
    });

    let deletedUsers = 0;
    for (const user of candidates) {
      const isEligible = await this.isEligibleForExternalCleanup(user.id);
      if (!isEligible) {
        continue;
      }
      await this.anonymizeAndDeleteUser(user.id, {
        reason: 'external_user_cleanup',
      });
      deletedUsers += 1;
    }

    return { deletedUsers };
  }

  async #countLoansByStatuses(userId, statuses) {
    return this.models.Loan.count({
      where: {
        userId,
        status: { [Op.in]: statuses },
      },
    });
  }

  async #getLoanStateCountsForUser(userId) {
    const [activeLoanCount, returnedLoanCount] = await Promise.all([
      this.#countLoansByStatuses(userId, ACTIVE_LOAN_STATUSES),
      this.#countLoansByStatuses(userId, [LOAN_STATUS.RETURNED]),
    ]);
    return { activeLoanCount, returnedLoanCount };
  }

  async anonymizeAndDeleteUser(userId, options = {}) {
    const privacyAuditContext = options.auditContext || this.#buildPrivacyAuditContext({
      actorId: options.actorId || null,
      reason: options.reason || 'manual',
      metadata: options.metadata || {},
    });
    const run = async (transaction) => {
      const user = await this.models.User.scope('withPassword').findByPk(userId, {
        paranoid: false,
        transaction,
      });
      if (!user || user.deletedAt) {
        return { filePaths: [] };
      }

      const filePaths = await this.#deleteUserSignatureRows(user.id, transaction);

      await this.models.UserRole.destroy({
        where: { userId: user.id },
        transaction,
      });

      const anonymizedIdentity = this.#buildAnonymizedUserIdentity(user.id);

      await user.update(
        {
          username: anonymizedIdentity.username,
          email: anonymizedIdentity.email,
          firstName: null,
          lastName: null,
          password: null,
          externalProvider: null,
          externalId: null,
          lastLoginAt: null,
          isActive: false,
        },
        { transaction }
      );

      if (!user.deletedAt) {
        await user.destroy({ transaction });
      }

      await this.#logPrivacyAudit(
        PRIVACY_AUDIT_ACTION.USER_DELETED,
        'User',
        user.id,
        privacyAuditContext,
        transaction
      );

      return { filePaths };
    };

    if (options.transaction) {
      return run(options.transaction);
    }

    const result = await this.models.sequelize.transaction(async (transaction) => run(transaction));
    // File deletions are intentionally outside DB transaction to avoid partial rollback on filesystem errors.
    await this.removeSignatureFiles(result.filePaths);
    return result;
  }

  #buildAnonymizedUserIdentity(userId) {
    const sanitizedId = String(userId || '').replace(/-/g, '');
    return {
      username: `deleted_${sanitizedId.slice(0, 24)}`,
      email: `deleted+${sanitizedId}@anon.invalid`,
    };
  }

  async #collectUserRelatedSignatures(userId, transaction) {
    const userLoans = await this.models.Loan.findAll({
      where: { userId },
      attributes: ['id'],
      transaction,
    });
    const loanIds = userLoans.map((row) => row.id);
    const where = loanIds.length
      ? {
          [Op.or]: [
            { userId },
            { loanId: { [Op.in]: loanIds } },
          ],
        }
      : { userId };
    return this.models.LoanSignature.findAll({
      where,
      attributes: ['id', 'filePath'],
      transaction,
    });
  }

  async #deleteUserSignatureRows(userId, transaction) {
    const signatureRows = await this.#collectUserRelatedSignatures(userId, transaction);
    const signatureIds = signatureRows.map((entry) => entry.id);
    if (signatureIds.length) {
      await this.models.LoanSignature.destroy({
        where: { id: signatureIds },
        transaction,
      });
    }
    return signatureRows.map((entry) => entry.filePath).filter(Boolean);
  }

  async removeSignatureFiles(filePaths) {
    const uniquePaths = Array.from(new Set((filePaths || []).filter(Boolean)));
    for (const source of uniquePaths) {
      let resolved = null;
      if (path.isAbsolute(source)) {
        resolved = path.resolve(source);
      } else {
        resolved = path.resolve(this.projectRoot, source);
      }
      // Guard against accidental deletion outside the uploads directory.
      const insideUploads =
        resolved === this.uploadRoot ||
        resolved.startsWith(`${this.uploadRoot}${path.sep}`);
      if (!insideUploads) {
        continue;
      }
      try {
        await fs.unlink(resolved);
      } catch (err) {
        if (!err || err.code !== 'ENOENT') {
          // ignore non-fatal file removal errors
        }
      }
    }
  }
}

module.exports = PrivacyService;
