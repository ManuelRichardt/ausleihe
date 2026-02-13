const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

class SignatureService {
  constructor(models) {
    this.models = models;
    this.uploadDir = path.join(__dirname, '..', 'uploads', 'signatures');
  }

  validateSignature(base64) {
    if (!base64 || typeof base64 !== 'string') {
      throw new Error('Signature data is required');
    }
    const normalized = base64.trim();
    if (normalized.startsWith('data:')) {
      if (!normalized.startsWith('data:image/png;base64,')) {
        throw new Error('Signature must be a PNG base64 data URL');
      }
      return normalized;
    }
    if (!normalized) {
      throw new Error('Signature data is required');
    }
    if (!/^[A-Za-z0-9+/=]+$/.test(normalized)) {
      throw new Error('Signature must be a PNG base64 data URL');
    }
    return `data:image/png;base64,${normalized}`;
  }

  decodeBase64(base64) {
    const payload = base64.split(',')[1];
    return Buffer.from(payload, 'base64');
  }

  async storeFile(buffer) {
    await fs.mkdir(this.uploadDir, { recursive: true });
    const filename = `${crypto.randomUUID()}.png`;
    const filePath = path.join(this.uploadDir, filename);
    await fs.writeFile(filePath, buffer);
    return filePath;
  }

  async createSignatureRecord(data) {
    const { LoanSignature } = this.models;
    return LoanSignature.create({
      loanId: data.loanId,
      userId: data.userId || null,
      signatureType: data.signatureType,
      signedByName: data.signedByName,
      signedAt: data.signedAt || new Date(),
      filePath: data.filePath,
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null,
      metadata: data.metadata || null,
    });
  }

  async attachToLoan(signature) {
    return signature;
  }

  async createFromBase64(payload) {
    const normalized = this.validateSignature(payload.base64);
    const buffer = this.decodeBase64(normalized);
    const filePath = await this.storeFile(buffer);
    const signature = await this.createSignatureRecord({
      loanId: payload.loanId,
      userId: payload.userId,
      signatureType: payload.signatureType,
      signedByName: payload.signedByName,
      signedAt: payload.signedAt,
      filePath,
      ipAddress: payload.ipAddress,
      userAgent: payload.userAgent,
      metadata: payload.metadata,
    });
    return this.attachToLoan(signature);
  }

  async getLoanDocumentData(loanId) {
    const {
      Loan,
      User,
      LoanItem,
      Asset,
      AssetModel,
      Manufacturer,
      AssetCategory,
      LoanSignature,
      CustomFieldValue,
      CustomFieldDefinition,
    } = this.models;
    const loan = await Loan.findByPk(loanId, {
      include: [
        { model: User, as: 'user' },
        {
          model: LoanItem,
          as: 'loanItems',
          include: [
            {
              model: AssetModel,
              as: 'assetModel',
              include: [
                { model: Manufacturer, as: 'manufacturer' },
                { model: AssetCategory, as: 'category' },
              ],
            },
            {
              model: Asset,
              as: 'asset',
              include: [
                {
                  model: AssetModel,
                  as: 'model',
                  include: [
                    { model: Manufacturer, as: 'manufacturer' },
                    { model: AssetCategory, as: 'category' },
                  ],
                },
                {
                  model: CustomFieldValue,
                  as: 'customFieldValues',
                  include: [{ model: CustomFieldDefinition, as: 'definition' }],
                },
              ],
            },
          ],
        },
        { model: LoanSignature, as: 'loanSignatures' },
      ],
    });
    if (!loan) {
      throw new Error('Loan not found');
    }
    const customFieldsByAsset = {};
    (loan.loanItems || []).forEach((item) => {
      const asset = item.asset;
      if (!asset) {
        return;
      }
      const values = asset.customFieldValues || [];
      customFieldsByAsset[asset.id] = values.map((value) => {
        const def = value.definition;
        const label = def ? (def.label || def.key) : 'Custom Field';
        const outputValue =
          value.valueString ||
          value.valueNumber ||
          (typeof value.valueBoolean === 'boolean' ? String(value.valueBoolean) : '') ||
          value.valueDate ||
          '';
        return { label, value: outputValue };
      });
    });
    return { loan, customFieldsByAsset };
  }
}

module.exports = SignatureService;
