import jstoxml from 'jstoxml';
import utility from 'utility';
import copy from 'copy-to';
import urlutil from 'url';

interface PutChannelConf {
  Description?: string;
  Status?: string;
  Target?: {
    Type: string;
    FragDuration: number;
    FragCount: number;
    PlaylistName: string;
  };
}

/**
 * Create a live channel
 * @param {String} id the channel id
 * @param {Object} conf the channel configuration
 * @param {Object} options
 * @return {Object}
 */
export async function putChannel(
  this: any,
  id: string,
  conf: PutChannelConf,
  options: any = {}
) {
  options.subres = 'live';

  const params = this._objectRequestParams('PUT', id, options);
  params.xmlResponse = true;
  params.content = jstoxml.toXML({
    LiveChannelConfiguration: conf,
  });
  params.successStatuses = [200];

  const result = await this.request(params);

  let publishUrls = result.data.PublishUrls.Url;
  if (!Array.isArray(publishUrls)) {
    publishUrls = [publishUrls];
  }
  let playUrls = result.data.PlayUrls.Url;
  if (!Array.isArray(playUrls)) {
    playUrls = [playUrls];
  }

  return {
    publishUrls,
    playUrls,
    res: result.res,
  };
}

/**
 * Get the channel info
 * @param {String} id the channel id
 * @param {Object} options
 * @return {Object}
 */
export async function getChannel(this: any, id: string, options: any = {}) {
  options.subres = 'live';

  const params = this._objectRequestParams('GET', id, options);
  params.xmlResponse = true;
  params.successStatuses = [200];

  const result = await this.request(params);

  return {
    data: result.data,
    res: result.res,
  };
}

/**
 * Delete the channel
 * @param {String} id the channel id
 * @param {Object} options
 * @return {Object}
 */
export async function deleteChannel(this: any, id: string, options: any = {}) {
  options.subres = 'live';

  const params = this._objectRequestParams('DELETE', id, options);
  params.successStatuses = [204];

  const result = await this.request(params);

  return {
    res: result.res,
  };
}

/**
 * Set the channel status
 * @param {String} id the channel id
 * @param {String} status the channel status
 * @param {Object} options
 * @return {Object}
 */
export async function putChannelStatus(
  this: any,
  id: string,
  status?: string,
  options: any = {}
) {
  options.subres = {
    live: null,
    status,
  };

  const params = this._objectRequestParams('PUT', id, options);
  params.successStatuses = [200];

  const result = await this.request(params);

  return {
    res: result.res,
  };
}

/**
 * Get the channel status
 * @param {String} id the channel id
 * @param {Object} options
 * @return {Object}
 */
export async function getChannelStatus(this: any, id: string, options: any = {}) {
  options.subres = {
    live: null,
    comp: 'stat',
  };

  const params = this._objectRequestParams('GET', id, options);
  params.xmlResponse = true;
  params.successStatuses = [200];

  const result = await this.request(params);

  return {
    data: result.data,
    res: result.res,
  };
}

/**
 * List the channels
 * @param {Object} query the query parameters
 *  filter options:
 *   - prefix {String}: the channel id prefix (returns channels with this prefix)
 *   - marker {String}: the channle id marker (returns channels after this id)
 *   - max-keys {Number}: max number of channels to return
 * @param {Object} options
 * @return {Object}
 */
export async function listChannels(this: any, query, options: any = {}) {
  // prefix, marker, max-keys

  options.subres = 'live';

  const params = this._objectRequestParams('GET', '', options);
  params.query = query;
  params.xmlResponse = true;
  params.successStatuses = [200];

  const result = await this.request(params);

  let channels = result.data.LiveChannel || [];
  if (!Array.isArray(channels)) {
    channels = [channels];
  }

  channels = channels.map(x => {
    x.PublishUrls = x.PublishUrls.Url;
    if (!Array.isArray(x.PublishUrls)) {
      x.PublishUrls = [x.PublishUrls];
    }
    x.PlayUrls = x.PlayUrls.Url;
    if (!Array.isArray(x.PlayUrls)) {
      x.PlayUrls = [x.PlayUrls];
    }

    return x;
  });

  return {
    channels,
    nextMarker: result.data.NextMarker || null,
    isTruncated: result.data.IsTruncated === 'true',
    res: result.res,
  };
}

/**
 * Get the channel history
 * @param {String} id the channel id
 * @param {Object} options
 * @return {Object}
 */
export async function getChannelHistory(this: any, id: string, options: any = {}) {
  options.subres = {
    live: null,
    comp: 'history',
  };

  const params = this._objectRequestParams('GET', id, options);
  params.xmlResponse = true;
  params.successStatuses = [200];

  const result = await this.request(params);

  let records = result.data.LiveRecord || [];
  if (!Array.isArray(records)) {
    records = [records];
  }
  return {
    records,
    res: result.res,
  };
}

/**
 * Create vod playlist
 * @param {String} id the channel id
 * @param {String} name the playlist name
 * @param {Object} time the begin and end time
 *  time:
 *   - startTime {Number}: the begin time in epoch seconds
 *   - endTime {Number}: the end time in epoch seconds
 * @param {Object} options
 * @return {Object}
 */
export async function createVod(this: any, id: string, name: string, time: { startTime: number; endTime: number }, options: any = {}) {
  options.subres = {
    vod: null,
  };
  copy(time, false).to(options.subres);

  const params = this._objectRequestParams('POST', `${id}/${name}`, options);
  params.query = time;
  params.successStatuses = [200];

  const result = await this.request(params);

  return {
    res: result.res,
  };
}

/**
 * Get RTMP Url
 * @param {String} channelId the channel id
 * @param {Object} options
 *  options:
 *   - expires {Number}: expire time in seconds
 *   - params {Object}: the parameters such as 'playlistName'
 * @return {String} the RTMP url
 */
export function getRtmpUrl(this: any, channelId: string, options: any = {}) {
  const expires = utility.timestamp() + (options.expires || 1800);
  const res = {
    bucket: this.options.bucket,
    object: this._objectName(`live/${channelId}`),
  };
  const resource = `/${res.bucket}/${channelId}`;

  options.params = options.params || {};
  const query = Object.keys(options.params)
    .sort()
    .map(x => `${x}:${options.params[x]}\n`)
    .join('');

  const stringToSign = `${expires}\n${query}${resource}`;
  const signature = this.signature(stringToSign);

  const url: any = urlutil.parse(this._getReqUrl(res));
  url.protocol = 'rtmp:';
  url.query = {
    OSSAccessKeyId: this.options.accessKeyId,
    Expires: expires,
    Signature: signature,
  };
  copy(options.params, false).to(url.query);

  return url.format();
}

export default {
  putChannel,
  getChannel,
  deleteChannel,
  putChannelStatus,
  getChannelStatus,
  listChannels,
  getChannelHistory,
  createVod,
  getRtmpUrl,
};