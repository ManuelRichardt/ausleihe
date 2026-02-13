class ReservationPortalService {
  constructor(models, loanService) {
    this.models = models;
    this.loanService = loanService;
  }

  #baseIncludes(options = {}) {
    const includes = [
      { model: this.models.LendingLocation, as: 'lendingLocation' },
      {
        model: this.models.LoanItem,
        as: 'loanItems',
        include: [
          {
            model: this.models.AssetModel,
            as: 'assetModel',
            include: [{ model: this.models.Manufacturer, as: 'manufacturer' }],
          },
          {
            model: this.models.Asset,
            as: 'asset',
            include: [
              {
                model: this.models.AssetModel,
                as: 'model',
                include: [{ model: this.models.Manufacturer, as: 'manufacturer' }],
              },
            ],
          },
        ],
      },
    ];
    if (options.includeUser) {
      includes.unshift({ model: this.models.User, as: 'user' });
    }
    return includes;
  }

  async listForUser(userId, filter = {}) {
    const status = filter.status || undefined;
    return this.loanService.getAll(
      {
        userId,
        status,
      },
      {
        include: this.#baseIncludes({ includeUser: false }),
        order: [['reservedFrom', 'DESC']],
      }
    );
  }

  async listForAdmin(lendingLocationId, filter = {}) {
    const status = filter.status || 'reserved';
    return this.loanService.getAll(
      {
        lendingLocationId,
        status,
      },
      {
        include: this.#baseIncludes({ includeUser: true }),
        order: [['reservedFrom', 'ASC']],
      }
    );
  }

  async getForUser(reservationId, userId) {
    const reservation = await this.loanService.getById(reservationId);
    if (reservation.userId !== userId) {
      const err = new Error('Reservation not found');
      err.status = 404;
      throw err;
    }
    return reservation;
  }

  async getForAdmin(reservationId, lendingLocationId) {
    const reservation = await this.loanService.getById(reservationId);
    if (!lendingLocationId || reservation.lendingLocationId !== lendingLocationId) {
      const err = new Error('Reservation not found');
      err.status = 404;
      throw err;
    }
    return reservation;
  }

  async cancelForUser(reservationId, userId, note) {
    const reservation = await this.getForUser(reservationId, userId);
    await this.loanService.cancelLoan(reservation.id, userId, note || null);
    return this.loanService.getById(reservation.id);
  }

  async cancelForAdmin(reservationId, lendingLocationId, actorId, note) {
    const reservation = await this.getForAdmin(reservationId, lendingLocationId);
    await this.loanService.cancelLoan(reservation.id, actorId, note || null);
    return this.loanService.getById(reservation.id);
  }
}

module.exports = ReservationPortalService;
