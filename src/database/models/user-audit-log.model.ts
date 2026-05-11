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
import {
  UserAuditLogActionType,
  UserAuditLogActionTypes
} from '../../types/user-audit-log.types';
import UserModel from './user.model';

@Table({ tableName: Tables.UserAuditLog, timestamps: true })
export class UserAuditLogModel extends Model {
  @PrimaryKey
  @Default(Sequelize.UUIDV4)
  @IsUUID(4)
  @Column(DataType.UUID)
  id!: string;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUID, allowNull: false })
  user_id!: string;

  @Column({
    type: DataType.ENUM(...Object.values(UserAuditLogActionTypes)),
    allowNull: false
  })
  action_type!: UserAuditLogActionType;

  @Column({ type: DataType.DATE, allowNull: false })
  occurred_at!: Date;

  @Column({ type: DataType.STRING, allowNull: false })
  request_id!: string;

  @Column({ type: DataType.STRING, allowNull: true })
  ip_address?: string;

  @Column({ type: DataType.STRING, allowNull: true })
  user_agent?: string;

  @Column({ type: DataType.JSONB, allowNull: false })
  metadata!: Record<string, unknown>;

  @Column({ type: DataType.STRING, allowNull: true })
  previous_hash?: string;

  @Column({ type: DataType.STRING, allowNull: false })
  entry_hash!: string;

  @BelongsTo(() => UserModel)
  user!: UserModel;
}

export default UserAuditLogModel;
