const { services, renderPage, handleError } = require('./web/_controllerUtils');
const SignatureService = require('../services/SignatureService');
const { generateLoanPdf } = require('../utils/pdfGenerator');
const models = require('../models');

class LoanSignatureController {
  constructor() {
    this.signatureService = new SignatureService(models);
  }

  resolveLoanBasePath(req, loan) {
    const canManage = services.authzService.hasPermission({
      userRoles: req.userRoles || [],
      permissionKey: 'loan.manage',
      lendingLocationId: loan ? loan.lendingLocationId : null,
    });
    return canManage ? `/admin/loans/${loan.id}` : `/loans/${loan.id}`;
  }

  async renderSignPage(req, res, next) {
    try {
      const loan = await services.loanService.getById(req.params.id);
      const loanBasePath = this.resolveLoanBasePath(req, loan);
      return renderPage(res, 'loans/sign', req, {
        loan,
        loanBasePath,
        signatureType: req.query.type || 'handover',
        breadcrumbs: [
          { label: 'Ausleihen', href: loanBasePath },
          { label: 'Signatur', href: `/loans/${loan.id}/sign` },
        ],
      });
    } catch (err) {
      if (err && err.message && err.message.toLowerCase().includes('not found')) {
        err.status = 404;
      }
      return handleError(res, next, req, err);
    }
  }

  async storeSignature(req, res, next) {
    try {
      const payload = {
        loanId: req.body.loanId || req.params.id,
        userId: req.user ? req.user.id : null,
        signatureType: req.body.signatureType,
        signedByName: req.body.signedByName,
        signedAt: req.body.signedAt || new Date(),
        base64: req.body.signatureBase64,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: {
          loanId: req.body.loanId || req.params.id,
        },
      };
      await this.signatureService.createFromBase64(payload);
      if (typeof req.flash === 'function') {
        req.flash('success', 'Signatur gespeichert');
      }
      const loan = await services.loanService.getById(payload.loanId);
      return res.redirect(this.resolveLoanBasePath(req, loan));
    } catch (err) {
      if (err && err.message && err.message.toLowerCase().includes('signature')) {
        const loan = await services.loanService.getById(req.params.id);
        res.status(422);
        return renderPage(res, 'loans/sign', req, {
          loan,
          loanBasePath: this.resolveLoanBasePath(req, loan),
          signatureType: req.body.signatureType || 'handover',
          errors: { signatureBase64: err.message },
          formData: req.body,
        });
      }
      if (err && err.message && err.message.toLowerCase().includes('not found')) {
        err.status = 404;
      }
      return handleError(res, next, req, err);
    }
  }

  async renderPrintableDocument(req, res, next) {
    try {
      const { loan, customFieldsByAsset } = await this.signatureService.getLoanDocumentData(req.params.id);
      const loanBasePath = this.resolveLoanBasePath(req, loan);

      if (req.query.format === 'pdf') {
        const pdfBuffer = await generateLoanPdf({ loan, customFieldsByAsset });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="loan-${loan.id}.pdf"`);
        return res.send(pdfBuffer);
      }

      return renderPage(res, 'loans/print', req, {
        loan,
        customFieldsByAsset,
        loanBasePath,
        breadcrumbs: [
          { label: 'Ausleihen', href: loanBasePath },
          { label: 'Dokument', href: `/loans/${loan.id}/print` },
        ],
      });
    } catch (err) {
      return handleError(res, next, req, err);
    }
  }
}

module.exports = LoanSignatureController;
