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
  ApplicationReviewOutcome,
  ApplicationReviewOutcomes,
  IWorkflowRequestItem,
  IWorkflowResponseItem
} from '../../types/application.types';
import { UserModel } from './user.model';
import ApplicationModel from './application.model';

@Table({
  tableName: Tables.ApplicationReview,
  timestamps: true,
  indexes: [{ unique: true, fields: ['application_id', 'cycle_number'] }]
})
export class ApplicationReviewModel extends Model {
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
  reviewer_id!: string;

  @Column({ type: DataType.INTEGER, allowNull: false })
  cycle_number!: number;

  @Column({ type: DataType.DATE, allowNull: false })
  started_at!: Date;

  @Column({ type: DataType.DATE, allowNull: true })
  completed_at?: Date;

  @Column({
    type: DataType.ENUM(...Object.values(ApplicationReviewOutcomes)),
    allowNull: true
  })
  outcome?: ApplicationReviewOutcome;

  @Column({ type: DataType.STRING, allowNull: true })
  notes?: string;

  @Column({ type: DataType.JSONB, allowNull: true })
  request_items?: IWorkflowRequestItem[] | null;

  @Column({ type: DataType.JSONB, allowNull: true })
  applicant_responses?: IWorkflowResponseItem[] | null;

  @Column({ type: DataType.DATE, allowNull: true })
  responded_at?: Date | null;

  @Column({ type: DataType.DATE, allowNull: false })
  created_at!: Date;

  @Column({ type: DataType.DATE, allowNull: false })
  updated_at!: Date;

  @BelongsTo(() => ApplicationModel)
  application!: ApplicationModel;

  @BelongsTo(() => UserModel)
  reviewer!: UserModel;
}

export default ApplicationReviewModel;
