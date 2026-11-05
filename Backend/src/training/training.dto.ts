import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBase64, IsIn, IsInt, IsISO8601, IsObject, IsString, Length, Max, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
export const LEARNING_RATES = [0.0003, 0.001, 0.003];
export const BATCH_SIZES = [8, 16, 32];
export const MODEL_SIZES = ['small', 'medium', 'large'];

export class DatasetDto {
  @Transform(trim) @IsString() @Length(1, 180) file_name!: string;
  @IsIn(['application/zip', 'application/x-zip-compressed']) content_type!: string;
  @IsBase64() archive_base64!: string;
  @IsArray() @ArrayMinSize(2) @ArrayMaxSize(128) @IsString({ each: true }) @Length(1, 80, { each: true }) labels!: string[];
  @IsInt() @Min(4) @Max(1000) samples!: number;
}
export class ReplaceDatasetDto extends DatasetDto {
  @IsISO8601() expected_updated_at!: string;
}
export class PreparationDto {
  @IsIn([10, 20, 30]) test_percent!: number;
}
export class TrainingConfigDto {
  @IsInt() @Min(5) @Max(30) epochs!: number;
  @IsIn(LEARNING_RATES) learning_rate!: number;
  @IsIn(BATCH_SIZES) batch_size!: number;
  @IsIn(MODEL_SIZES) model_size!: string;
}
export class TrainingRunDto {
  @IsInt() @Min(1) @Max(100000) run_number!: number;
  @IsObject() config!: Record<string, unknown>;
  @IsObject() hardware!: Record<string, unknown>;
  @IsArray() @ArrayMinSize(5) @ArrayMaxSize(30) history!: unknown[];
  @IsObject() metrics!: Record<string, unknown>;
  @IsInt() @Min(0) @Max(86400000) duration_ms!: number;
  @IsBase64() model_base64!: string;
}
