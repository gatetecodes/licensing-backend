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
import DocumentModel from './document.model';
import UserModel from './user.model';

@Table({
  tableName: Tables.DocumentVersion,
  timestamps: false,
  indexes: [{ unique: true, fields: ['document_id', 'version_number'] }]
})
export class DocumentVersionModel extends Model {
  @PrimaryKey
  @Default(Sequelize.UUIDV4)
  @IsUUID(4)
  @Column(DataType.UUID)
  id!: string;

  @ForeignKey(() => DocumentModel)
  @Column(DataType.UUID)
  document_id!: string;

  @Column({ type: DataType.INTEGER, allowNull: false })
  version_number!: number;

  @Column({ type: DataType.STRING, allowNull: false })
  stored_filename!: string;

  @Column({ type: DataType.STRING, allowNull: false })
  original_filename!: string;

  @Column({ type: DataType.STRING, allowNull: false })
  mime_type!: string;

  @Column({ type: DataType.INTEGER, allowNull: false })
  file_size_bytes!: number;

  @Column({ type: DataType.STRING, allowNull: false })
  checksum!: string;

  @ForeignKey(() => UserModel)
  @Column(DataType.UUID)
  uploaded_by_id!: string;

  @Column({ type: DataType.DATE, allowNull: false })
  uploaded_at!: Date;

  @ForeignKey(() => DocumentVersionModel)
  @Column(DataType.UUID)
  supersedes_version_id?: string;

  @BelongsTo(() => DocumentModel)
  document!: DocumentModel;

  @BelongsTo(() => UserModel)
  uploaded_by!: UserModel;

  @BelongsTo(() => DocumentVersionModel)
  supersedes_version!: DocumentVersionModel;
}

export default DocumentVersionModel;
