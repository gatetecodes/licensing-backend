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
  AuditLogActionType,
  AuditLogActionTypes
} from '../../types/audit-log.types';
import ApplicationModel from './application.model';
import UserModel from './user.model';

@Table({ tableName: Tables.AuditLog, timestamps: true })
export class AuditLogModel extends Model {
  @PrimaryKey
  @Default(Sequelize.UUIDV4)
  @IsUUID(4)
  @Column(DataType.UUID)
  id!: string;

  @ForeignKey(() => ApplicationModel)
  @Column(DataType.UUID)
  application_id!: string;

  @ForeignKey(() => UserModel)
  @Column(DataType.UUID)
  acting_user_id!: string;

  @Column({
    type: DataType.ENUM(...Object.values(AuditLogActionTypes)),
    allowNull: false
  })
  action_type!: AuditLogActionType;

  @Column({ type: DataType.DATE, allowNull: false })
  occurred_at!: Date;

  @Column({ type: DataType.STRING, allowNull: true })
  before_state?: string;

  @Column({ type: DataType.STRING, allowNull: true })
  after_state?: string;

  @Column({ type: DataType.STRING, allowNull: false })
  request_id!: string;

  @Column({ type: DataType.STRING, allowNull: true })
  ip_address?: string;

  @Column({ type: DataType.STRING, allowNull: true })
  user_agent?: string;

  @Column({ type: DataType.JSONB, allowNull: false })
  metadata!: Record<string, any>;

  @Column({ type: DataType.STRING, allowNull: true })
  previous_hash?: string;

  @Column({ type: DataType.STRING, allowNull: false })
  entry_hash!: string;

  @BelongsTo(() => ApplicationModel)
  application!: ApplicationModel;

  @BelongsTo(() => UserModel)
  acting_user!: UserModel;
}

export default AuditLogModel;
