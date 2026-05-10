import {
  Table,
  Column,
  DataType,
  PrimaryKey,
  Default,
  IsUUID,
  ForeignKey,
  Model,
  BelongsTo
} from 'sequelize-typescript';
import Sequelize from 'sequelize';
import { Tables } from '../tables';
import UserModel from './user.model';
import RoleModel from './role.model';

@Table({ tableName: Tables.UserRole, timestamps: true })
export class UserRoleModel extends Model {
  @PrimaryKey
  @Default(Sequelize.UUIDV4)
  @IsUUID(4)
  @Column(DataType.UUID)
  id!: string;

  @ForeignKey(() => UserModel)
  @Column(DataType.UUID)
  user_id!: string;

  @ForeignKey(() => RoleModel)
  @Column(DataType.UUID)
  role_id!: string;

  @Column({ type: DataType.DATE, allowNull: false })
  created_at!: Date;

  @Column({ type: DataType.DATE, allowNull: false })
  updated_at!: Date;

  @BelongsTo(() => UserModel)
  user!: UserModel;

  @BelongsTo(() => RoleModel)
  role!: RoleModel;
}

export default UserRoleModel;
