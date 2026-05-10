import {
  Table,
  Model,
  Column,
  DataType,
  PrimaryKey,
  ForeignKey,
  BelongsTo
} from 'sequelize-typescript';
import { Tables } from '../tables';
import UserModel from './user.model';

@Table({
  tableName: Tables.Session,
  timestamps: false,
  indexes: [{ fields: ['user_id'] }, { fields: ['expires_at'] }]
})
export class SessionModel extends Model {
  @PrimaryKey
  @Column({ type: DataType.STRING, allowNull: false })
  id!: string;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUID, allowNull: true })
  user_id?: string;

  @Column({ type: DataType.JSONB, allowNull: false })
  data!: Record<string, any>;

  @Column({ type: DataType.DATE, allowNull: false })
  expires_at!: Date;

  @BelongsTo(() => UserModel)
  user!: UserModel;
}

export default SessionModel;
