import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type RateCardDocument = HydratedDocument<RateCard>;

@Schema({ timestamps: true, collection: 'rate_cards' })
export class RateCard {
  @Prop({ required: true, unique: true, trim: true, uppercase: true, immutable: true }) code: string;
  @Prop({ required: true, trim: true }) description: string;
  @Prop({ required: true, trim: true }) unit: string;
  @Prop({ required: true, min: 0 }) price: number;
  @Prop({ default: true }) isActive: boolean;
}

export const RateCardSchema = SchemaFactory.createForClass(RateCard);
RateCardSchema.index({ code: 'text', description: 'text', unit: 'text' });
