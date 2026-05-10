import { WhereOptions, FindOptions, DestroyOptions } from 'sequelize';
import { Model, Repository } from 'sequelize-typescript';
import { PaginationArgs, FindModelOptions } from '../../../types/shared.types';
import { getPagination } from '../../../helpers/pagination';
import { Response, NextFunction } from 'express';
import { handleRepositoryError } from '../../../middlewares/error-handler.middleware';

export class BaseRepository<M extends Model> {
  private _model: Repository<M>;

  constructor(model: Repository<M>) {
    this._model = model;
  }

  protected createRecord = async (options: M[any]) => {
    return this._model.create(options);
  };

  protected createManyRecords = async (options: M[any]) => {
    return this._model.bulkCreate(options);
  };

  protected getAllRecord = async (
    options?: FindModelOptions<M>,
    paginate?: PaginationArgs
  ) => {
    if (paginate) {
      const pagination = await getPagination(paginate, this._model);

      const data = await this._model.findAll({
        ...options,
        limit: pagination.limit,
        offset: pagination.offset
      });

      return {
        items: data,
        ...pagination
      };
    }
    const data = await this._model.findAll(options);

    return {
      items: data
    };
  };

  protected getRecordByField = async (
    where: WhereOptions<M>,
    option?: FindOptions
  ) => {
    return await this._model.findOne({ ...option, where });
  };

  protected updateRecord = async (
    where: WhereOptions<M>,
    options: M[any],
    rest?: any
  ) => {
    const update = await this._model.update(options, {
      where,
      ...rest
    });
    if (update[0] === 1) {
      return update;
    }

    throw new Error('Unable to update');
  };

  protected deleteRecord = async (
    where: WhereOptions<M>,
    options?: DestroyOptions
  ) => {
    const del = await this._model.destroy({ where, ...options });

    if (del === 1) {
      return true;
    }

    throw new Error('Unable to delete');
  };

  /**
   * Helper method for consistent error handling across all repositories
   * @param error - The caught error
   * @param res - Express response object
   * @param next - Express next function
   * @param event - Logger event for the operation
   * @param payload - Additional data to log
   */
  protected handleError(
    error: any,
    res: Response,
    next: NextFunction,
    event: string,
    payload?: any
  ): void {
    handleRepositoryError(error, res, next, event, payload);
  }
}
