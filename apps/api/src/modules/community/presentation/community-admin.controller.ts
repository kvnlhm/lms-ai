import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@lms/contracts';
import { ApiEnvelope, ApiEnvelopeArray, ApiErrors } from '../../../shared/http/api-envelope';
import type { AuthenticatedUser } from '../../identity/domain/session';
import { CurrentUser, RequirePermissions } from '../../identity/presentation/decorators';
import { CommunityService } from '../application/community.service';
import { AdminCommunityChannelDto, CommunitySubchannelDto, CreateCommunityChannelDto, CreateCommunitySubchannelDto, UpdateCommunityChannelDto, UpdateCommunitySubchannelDto } from './community.dto';

@ApiTags('admin-community')
@Controller('admin/community/channels')
@RequirePermissions(PERMISSIONS.DISCUSSIONS_MODERATE)
export class CommunityAdminController {
  constructor(private readonly community: CommunityService) {}
  @Get() @ApiEnvelopeArray(AdminCommunityChannelDto) @ApiErrors(401, 403) list() { return this.community.listChannels(true); }
  @Post() @HttpCode(201) @ApiEnvelope(AdminCommunityChannelDto) @ApiErrors(401, 403, 422)
  create(@Body() dto: CreateCommunityChannelDto, @CurrentUser() user: AuthenticatedUser) { return this.community.createChannel(user.id, dto); }
  @Patch(':id') @ApiEnvelope(AdminCommunityChannelDto) @ApiErrors(401, 403, 404, 422)
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateCommunityChannelDto) { return this.community.updateChannel(id, dto); }
  @Delete(':id') @HttpCode(204) @ApiOperation({ summary: 'Mengarsipkan channel; isinya disembunyikan, bukan dihapus' }) @ApiErrors(401, 403, 404)
  archive(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.community.archiveChannel(user.id, id);
  }

  @Delete(':id/permanent') @HttpCode(204) @ApiOperation({ summary: 'Menghapus permanen channel yang sudah diarsipkan beserta seluruh isinya' }) @ApiErrors(401, 403, 404, 422)
  deletePermanently(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.community.deleteChannelPermanently(user.id, id);
  }

  @Post(':id/restore') @ApiOperation({ summary: 'Mengembalikan channel yang diarsipkan' }) @ApiEnvelope(AdminCommunityChannelDto) @ApiErrors(401, 403, 404)
  restore(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.community.restoreGroup(user.id, id);
  }

  @Post(':id/subchannels') @HttpCode(201) @ApiEnvelope(CommunitySubchannelDto) @ApiErrors(401, 403, 404, 422)
  createSubchannel(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: CreateCommunitySubchannelDto, @CurrentUser() user: AuthenticatedUser) {
    return this.community.createSubchannel(user.id, id, dto);
  }

  @Patch('subchannels/:id') @ApiEnvelope(CommunitySubchannelDto) @ApiErrors(401, 403, 404, 422)
  updateSubchannel(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateCommunitySubchannelDto) {
    return this.community.updateSubchannel(id, dto);
  }

  @Delete('subchannels/:id') @HttpCode(204) @ApiErrors(401, 403, 404)
  archiveSubchannel(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.community.archiveSubchannel(user.id, id);
  }

  @Post('subchannels/:id/restore') @ApiEnvelope(CommunitySubchannelDto) @ApiErrors(401, 403, 404)
  restoreSubchannel(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.community.restoreSubchannel(user.id, id);
  }
}
