const fs = require('fs/promises');
const path = require('path');
const { Op } = require('sequelize');
const { buildListOptions } = require('./_serviceUtils');

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
        status: { [Op.in]: ['open', 'in_progress'] },
      },
    });
    if (existingOpen) {
      throw new Error('Für diesen Benutzer existiert bereits eine offene Löschanfrage.');
    }
    const request = await this.models.PrivacyDeletionRequest.create({
      userId: data.userId,
      requestedByUserId: data.requestedByUserId || null,
      status: 'open',
      requestNote: data.requestNote || null,
      metadata: data.metadata || null,
    });
    if (data.requestedByUserId) {
      await this.models.AuditLog.create({
        userId: data.requestedByUserId,
        action: 'privacy.deletion_request.created',
        entity: 'PrivacyDeletionRequest',
        entityId: request.id,
        metadata: {
          targetUserId: data.userId,
        },
      });
    }
    return request;
  }

  async rejectDeletionRequest(id, data = {}) {
    const request = await this.models.PrivacyDeletionRequest.findByPk(id);
    if (!request) {
      throw new Error('Löschanfrage nicht gefunden.');
    }
    if (['completed', 'rejected'].includes(request.status)) {
      throw new Error('Löschanfrage wurde bereits abgeschlossen.');
    }
    await request.update({
      status: 'rejected',
      processNote: data.processNote || null,
      processedByUserId: data.processedByUserId || null,
      processedAt: new Date(),
    });
    if (data.processedByUserId) {
      await this.models.AuditLog.create({
        userId: data.processedByUserId,
        action: 'privacy.deletion_request.rejected',
        entity: 'PrivacyDeletionRequest',
        entityId: request.id,
        metadata: {
          targetUserId: request.userId,
        },
      });
    }
    return request;
  }

  async processDeletionRequest(id, data = {}) {
    const { sequelize } = this.models;
    const txResult = await sequelize.transaction(async (transaction) => {
      const request = await this.models.PrivacyDeletionRequest.findByPk(id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!request) {
        throw new Error('Löschanfrage nicht gefunden.');
      }
      if (request.status === 'completed') {
        throw new Error('Löschanfrage wurde bereits verarbeitet.');
      }
      if (request.status === 'rejected') {
        throw new Error('Löschanfrage wurde abgelehnt.');
      }

      const activeLoanCount = await this.models.Loan.count({
        where: {
          userId: request.userId,
          status: { [Op.in]: ['reserved', 'handed_over', 'overdue'] },
        },
        transaction,
      });
      if (activeLoanCount > 0) {
        throw new Error('Benutzer hat noch aktive Ausleihen oder Reservierungen.');
      }

      const anonymizeResult = await this.anonymizeAndDeleteUser(
        request.userId,
        {
          transaction,
          actorId: data.processedByUserId || null,
          reason: 'deletion_request',
        }
      );

      await request.update(
        {
          status: 'completed',
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

    await this.removeSignatureFiles(txResult.filePaths);
    return txResult.request;
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
        status: 'returned',
        returnedAt: { [Op.lte]: cutoff },
      },
      attributes: ['id'],
    });

    let deletedLoans = 0;
    let deletedSignatures = 0;
    const filesToDelete = [];

    for (const loan of loans) {
      const result = await this.models.sequelize.transaction(async (transaction) => {
        const signatures = await this.models.LoanSignature.findAll({
          where: { loanId: loan.id },
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
          where: { loanId: loan.id },
          transaction,
        });

        await this.models.LoanItem.destroy({
          where: {
            loanId: loan.id,
            parentLoanItemId: { [Op.not]: null },
          },
          force: true,
          transaction,
        });
        await this.models.LoanItem.destroy({
          where: {
            loanId: loan.id,
            parentLoanItemId: null,
          },
          force: true,
          transaction,
        });

        await this.models.Loan.destroy({
          where: { id: loan.id },
          force: true,
          transaction,
        });

        return {
          deletedSignatures: signatureIds.length,
          filePaths,
        };
      });

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

  async deleteStaleExternalUsers() {
    const candidates = await this.models.User.findAll({
      where: {
        externalProvider: { [Op.in]: ['saml', 'ldap'] },
      },
      attributes: ['id'],
    });

    let deletedUsers = 0;
    for (const user of candidates) {
      const activeLoanCount = await this.models.Loan.count({
        where: {
          userId: user.id,
          status: { [Op.in]: ['reserved', 'handed_over', 'overdue'] },
        },
      });
      if (activeLoanCount > 0) {
        continue;
      }
      const returnedLoanCount = await this.models.Loan.count({
        where: {
          userId: user.id,
          status: 'returned',
        },
      });
      if (returnedLoanCount > 0) {
        continue;
      }
      await this.anonymizeAndDeleteUser(user.id, {
        reason: 'external_user_cleanup',
      });
      deletedUsers += 1;
    }

    return { deletedUsers };
  }

  async anonymizeAndDeleteUser(userId, options = {}) {
    const run = async (transaction) => {
      const user = await this.models.User.scope('withPassword').findByPk(userId, {
        paranoid: false,
        transaction,
      });
      if (!user || user.deletedAt) {
        return { filePaths: [] };
      }

      const signatureRows = await this.#collectUserRelatedSignatures(user.id, transaction);
      const signatureIds = signatureRows.map((entry) => entry.id);
      const filePaths = signatureRows.map((entry) => entry.filePath).filter(Boolean);

      if (signatureIds.length) {
        await this.models.LoanSignature.destroy({
          where: { id: signatureIds },
          transaction,
        });
      }

      await this.models.UserRole.destroy({
        where: { userId: user.id },
        transaction,
      });

      const sanitizedId = String(user.id || '').replace(/-/g, '');
      const anonymizedUsername = `deleted_${sanitizedId.slice(0, 24)}`;
      const anonymizedEmail = `deleted+${sanitizedId}@anon.invalid`;

      await user.update(
        {
          username: anonymizedUsername,
          email: anonymizedEmail,
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

      if (options.actorId) {
        await this.models.AuditLog.create(
          {
            userId: options.actorId,
            action: 'privacy.user_deleted',
            entity: 'User',
            entityId: user.id,
            metadata: {
              reason: options.reason || 'manual',
            },
          },
          { transaction }
        );
      }

      return { filePaths };
    };

    if (options.transaction) {
      return run(options.transaction);
    }

    const result = await this.models.sequelize.transaction(async (transaction) => run(transaction));
    await this.removeSignatureFiles(result.filePaths);
    return result;
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

  async removeSignatureFiles(filePaths) {
    const uniquePaths = Array.from(new Set((filePaths || []).filter(Boolean)));
    for (const source of uniquePaths) {
      let resolved = null;
      if (path.isAbsolute(source)) {
        resolved = path.resolve(source);
      } else {
        resolved = path.resolve(this.projectRoot, source);
      }
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
