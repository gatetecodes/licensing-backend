import { Response } from 'express';
import { WhereOptions, FindOptions, CountOptions } from 'sequelize';

export interface IKeyValuePair {
  [key: string]: string | number | any;
}

export interface IMeta {
  total?: number;
  pages?: number;
}

export interface ResponseWrapper<Data> {
  res: Response;
  status: number;
  message?: string;
  context?: string;
  data?: Data;
  meta?: IMeta;
  errors?: Array<{
    message: string;
    field?: string;
    type?: string;
    value?: any;
  }>;
  [key: string]: any;
}

export interface PaginationArgs {
  limit?: number;
  page?: number;
  filter?: CountOptions<any>;
  fetchAll?: boolean;
}

export interface GetPaginationResponse extends IMeta, PaginationArgs {
  offset: number;
}

export interface FindModelOptions<Model> extends FindOptions {
  where?: WhereOptions<Model>;
}

export type IUKnownObject = Record<string, unknown>;

export interface BaseResponse {
  message: string;
  status: number;
}

export interface SuccessResponse<D, M = IMeta> extends BaseResponse {
  data?: D;
  meta?: M;
}

export type ValidationError = {
  message: string;
  field?: string;
  type?: string;
  value?: unknown;
};

export interface ErrorResponse<E> extends BaseResponse {
  context: string;
  errors?: Array<ValidationError> | E;
}

export type ApiResponse<T, M = IMeta> =
  | SuccessResponse<T, M>
  | ErrorResponse<T>;
