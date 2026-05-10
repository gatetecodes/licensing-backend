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
  DocumentType,
  DocumentTypes,
  IDocument
} from '../../types/document.types';
import ApplicationModel from './application.model';

@Table({ tableName: Tables.Document, timestamps: false })
export class DocumentModel extends Model<IDocument> {
  @PrimaryKey
  @Default(Sequelize.UUIDV4)
  @IsUUID(4)
  @Column(DataType.UUID)
  id!: string;

  @ForeignKey(() => ApplicationModel)
  @Column(DataType.UUID)
  application_id!: string;

  @Column({
    type: DataType.ENUM(...Object.values(DocumentTypes)),
    allowNull: false
  })
  document_type!: DocumentType;

  @Default(Sequelize.literal('CURRENT_TIMESTAMP'))
  @Column({ type: DataType.DATE, allowNull: false })
  created_at!: Date;

  @BelongsTo(() => ApplicationModel)
  application!: ApplicationModel;
}

export default DocumentModel;
