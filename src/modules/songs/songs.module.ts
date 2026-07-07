import { Module } from '@nestjs/common';
import { SongsController } from './songs.controller';
import { SongsService } from './songs.service';
import { YoutubeService } from './youtube.service';

@Module({
  controllers: [SongsController],
  providers: [SongsService, YoutubeService],
  exports: [SongsService],
})
export class SongsModule {}
