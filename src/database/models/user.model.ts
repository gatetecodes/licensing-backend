import {
  Table,
  Model,
  Column,
  DataType,
  PrimaryKey,
  Default,
  IsUUID,
  HasMany
} from 'sequelize-typescript';
import Sequelize from 'sequelize';
import { Tables } from '../tables';
import { User, UserCreate, UserStatus, UserStatusType } from '../../types/user.types';
import UserRoleModel from './user-role.model';

@Table({
  tableName: Tables.User,
  timestamps: true,
  indexes: [{ unique: true, fields: ['email'] }]
})
export class UserModel extends Model<User, UserCreate> {
  @PrimaryKey
  @Default(Sequelize.UUIDV4)
  @IsUUID(4)
  @Column(DataType.UUID)
  id!: string;

  @Column({ type: DataType.STRING, allowNull: false })
  name!: string;

  @Column({ type: DataType.STRING, allowNull: false })
  email!: string;

  @Column({ type: DataType.STRING, allowNull: false })
  password!: string;

  @Column({ type: DataType.STRING, allowNull: false })
  institution_name!: string;

  @Column({ type: DataType.DATE, allowNull: true })
  email_verified_at?: Date;

  @Column({ type: DataType.ENUM(...Object.values(UserStatus)), allowNull: false })
  status!: UserStatusType;

  @Column({ type: DataType.DATE, allowNull: false })
  created_at!: Date;

  @Column({ type: DataType.DATE, allowNull: false })
  updated_at!: Date;

  @HasMany(() => UserRoleModel)
  userRoles!: UserRoleModel[];
}

export default UserModel;
