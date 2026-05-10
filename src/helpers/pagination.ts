import { GetPaginationResponse, PaginationArgs } from '../types/shared.types';
import { Model } from 'sequelize';
import { Repository } from 'sequelize-typescript';

export const getPagination = async (
  paginationArg: PaginationArgs,
  repository?: Repository<Model> 
): Promise<GetPaginationResponse> => {
  const limit = paginationArg.limit || 15;

  const page =
    paginationArg.page && paginationArg.page > 0 ? paginationArg.page - 1 : 0;

  const offset = page * limit;

  let total;
  let pages;

  if (repository) {
    const countOptions = paginationArg.filter ? { ...paginationArg.filter } : {};
    total = await repository.count(countOptions);

    pages = Math.ceil(total / limit);
  }

  return {
    limit,
    offset,
    total,
    pages,
    page: paginationArg.page
  };
};
