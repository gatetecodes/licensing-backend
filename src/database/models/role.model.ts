import {
  Table,
  Model,
  Column,
  DataType,
  PrimaryKey,
  Default,
  IsUUID
} from 'sequelize-typescript';
import Sequelize from 'sequelize';
import { Tables } from '../tables';
import { Role, RoleCreate, RoleType } from '../../types/role.types';

@Table({
  tableName: Tables.Role,
  timestamps: true,
  indexes: [{ unique: true, fields: ['name'] }]
})
export class RoleModel extends Model<Role, RoleCreate> {
  @PrimaryKey
  @Default(Sequelize.UUIDV4)
  @IsUUID(4)
  @Column(DataType.UUID)
  id!: string;

  @Column({ type: DataType.STRING, allowNull: false })
  name!: RoleType;

  @Column({ type: DataType.STRING, allowNull: true })
  description?: string;

  @Column({ type: DataType.DATE, allowNull: false })
  created_at!: Date;

  @Column({ type: DataType.DATE, allowNull: false })
  updated_at!: Date;
}

export default RoleModel;
