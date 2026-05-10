import {
  Table,
  Model,
  Column,
  DataType,
  PrimaryKey,
  Default,
  IsUUID,
  ForeignKey,
  BelongsTo
} from 'sequelize-typescript';
import Sequelize from 'sequelize';
import { Tables } from '../tables';
import UserModel from './user.model';
import {
  AuthTokenType,
  AuthTokenTypes
} from '../../types/auth-token.types';

@Table({
  tableName: Tables.AuthToken,
  timestamps: false,
  indexes: [
    { unique: true, fields: ['token_hash'] },
    { fields: ['user_id', 'token_type', 'created_at'] },
    { fields: ['token_type', 'expires_at', 'consumed_at'] }
  ]
})
export class AuthTokenModel extends Model {
  @PrimaryKey
  @Default(Sequelize.UUIDV4)
  @IsUUID(4)
  @Column(DataType.UUID)
  id!: string;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUID, allowNull: false })
  user_id!: string;

  @Column({ type: DataType.STRING, allowNull: false })
  token_hash!: string;

  @Column({
    type: DataType.ENUM(...Object.values(AuthTokenTypes)),
    allowNull: false
  })
  token_type!: AuthTokenType;

  @Column({ type: DataType.DATE, allowNull: false })
  expires_at!: Date;

  @Column({ type: DataType.DATE, allowNull: true })
  consumed_at?: Date;

  @Column({ type: DataType.DATE, allowNull: false })
  created_at!: Date;

  @BelongsTo(() => UserModel)
  user!: UserModel;
}

export default AuthTokenModel;
