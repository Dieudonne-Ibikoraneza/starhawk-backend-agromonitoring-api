import { DocumentResponseDto } from './document-response.dto';

export class NidaResponseDto {
  status: number;
  message: string;
  timestamp: string;
  data: DocumentResponseDto | null;
}

