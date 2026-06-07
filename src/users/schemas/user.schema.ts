import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { UserStatus } from '../enums/user-status.enum';
import { Role } from '../enums/role.enum';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true, unique: true })
  phoneNumber: string;

  @Prop({ required: true, unique: true })
  nationalId: string;

  @Prop({ required: true })
  password: string;

  @Prop()
  rawPassword?: string;

  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ required: true, enum: Role, default: Role.FARMER })
  role: Role;

  @Prop({ default: true })
  active: boolean;

  @Prop({ type: String, enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  @Prop({ default: true })
  firstLoginRequired: boolean;

  // Location data from NIDA
  @Prop()
  province?: string;

  @Prop()
  district?: string;

  @Prop()
  sector?: string;

  @Prop()
  cell?: string;

  @Prop()
  village?: string;

  @Prop()
  sex?: string;

  @Prop()
  signatureUrl?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.virtual('insurerProfile', {
  ref: 'InsurerProfile',
  localField: '_id',
  foreignField: 'userId',
  justOne: true
});

UserSchema.set('toJSON', { virtuals: true });
UserSchema.set('toObject', { virtuals: true });

// Indexes
UserSchema.index({ role: 1 });
UserSchema.index({ active: 1 });
UserSchema.index({ status: 1 });

