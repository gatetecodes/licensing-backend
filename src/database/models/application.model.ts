import {
  Table,
  Model,
  Column,
  DataType,
  PrimaryKey,
  Default,
  IsUUID,
  ForeignKey,
  HasMany,
  BelongsTo
} from 'sequelize-typescript';
import Sequelize from 'sequelize';
import { Tables } from '../tables';
import {
  ApplicationState,
  ApplicationStates,
  IApplication,
  IApplicationCreate,
  InstitutionType,
  InstitutionTypes,
  LicenseCategory,
  LicenseCategories
} from '../../types/application.types';
import UserModel from './user.model';
import DocumentModel from './document.model';
import ApplicationReviewModel from './application-review.model';

@Table({
  tableName: Tables.Application,
  timestamps: true,
  indexes: [{ unique: true, fields: ['reference_number'] }]
})
export class ApplicationModel extends Model<IApplication, IApplicationCreate> {
  @PrimaryKey
  @Default(Sequelize.UUIDV4)
  @IsUUID(4)
  @Column(DataType.UUID)
  id!: string;

  @Column({ type: DataType.STRING, allowNull: false })
  reference_number!: string;

  @ForeignKey(() => UserModel)
  @Column(DataType.UUID)
  applicant_id!: string;

  @Column({ type: DataType.STRING, allowNull: false })
  institution_name!: string;

  @Column({
    type: DataType.ENUM(...Object.values(InstitutionTypes)),
    allowNull: false
  })
  institution_type!: InstitutionType;

  @Column({ type: DataType.STRING, allowNull: true })
  business_address?: string;

  @Column({ type: DataType.STRING, allowNull: true })
  contact_name?: string;

  @Column({ type: DataType.STRING, allowNull: true })
  contact_email?: string;

  @Column({ type: DataType.STRING, allowNull: true })
  contact_phone?: string;

  @Column({
    type: DataType.ENUM(...Object.values(LicenseCategories)),
    allowNull: true
  })
  license_category?: LicenseCategory;

  @Column({ type: DataType.STRING, allowNull: true })
  license_category_other_details?: string;

  @Column({ type: DataType.DECIMAL(18, 2), allowNull: true })
  capital_amount_rwf?: number;

  @Column({ type: DataType.DATEONLY, allowNull: true })
  incorporation_date?: Date;

  @Column({ type: DataType.TEXT, allowNull: true })
  business_summary?: string;

  @Column({
    type: DataType.ENUM(...Object.values(ApplicationStates)),
    allowNull: false
  })
  current_state!: ApplicationState;

  @Column({ type: DataType.DATE, allowNull: true })
  submitted_at?: Date;

  @ForeignKey(() => UserModel)
  @Column(DataType.UUID)
  reviewed_by_id?: string;

  @ForeignKey(() => UserModel)
  @Column(DataType.UUID)
  decisioned_by_id?: string;

  @Column({ type: DataType.DATE, allowNull: true })
  decision_at?: Date;

  @Column({ type: DataType.STRING, allowNull: true })
  decision_reason?: string;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  lock_version!: number;

  @Column({ type: DataType.DATE, allowNull: false })
  created_at!: Date;

  @Column({ type: DataType.DATE, allowNull: false })
  updated_at!: Date;

  @HasMany(() => DocumentModel)
  documents!: DocumentModel[];

  @HasMany(() => ApplicationReviewModel)
  reviews!: ApplicationReviewModel[];

  @BelongsTo(() => UserModel)
  applicant!: UserModel;

  @BelongsTo(() => UserModel)
  reviewed_by!: UserModel;

  @BelongsTo(() => UserModel)
  decisioned_by!: UserModel;
}

export default ApplicationModel;
