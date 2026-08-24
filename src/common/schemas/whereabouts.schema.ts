import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type WhereaboutsDocument = HydratedDocument<Whereabouts>;

@Schema({ timestamps: true, collection: 'whereabouts' })
export class Whereabouts {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ type: Types.ObjectId, required: true, ref: 'Project' })
  projectId: Types.ObjectId;

  @Prop({ type: Date, required: true })
  startDate: Date;

  @Prop({ type: Date, required: true })
  endDate: Date;

  @Prop({
    type: {
      address: { type: String, required: true },
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
    },
    required: true,
  })
  location: {
    address: string;
    latitude?: number | null;
    longitude?: number | null;
  };

  @Prop({ type: [{ type: Types.ObjectId, ref: 'TeamMember' }], default: [] })
  engineers: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'TeamMember' }], default: [] })
  workers: Types.ObjectId[];

  @Prop({ type: String, default: '' })
  notes: string;
}

export const WhereaboutsSchema = SchemaFactory.createForClass(Whereabouts);
WhereaboutsSchema.index({ startDate: 1, endDate: 1 });
WhereaboutsSchema.index({ title: 'text' });
