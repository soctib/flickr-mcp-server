export interface FlickrPhoto {
  id: string;
  owner: string;
  secret: string;
  server: string;
  farm: number;
  title: string | { _content: string };
  description?: { _content: string };
  tags?: string;
  datetaken?: string;
  dateupload?: string;
  views?: string;
  count_faves?: string;
  count_comments?: string;
  url_sq?: string;
}

export interface FlickrPhotoInfo {
  id: string;
  secret: string;
  server: string;
  farm: number;
  title: { _content: string };
  description: { _content: string };
  dates: {
    posted: string;
    taken: string;
    lastupdate: string;
  };
  views: string;
  tags: {
    tag: Array<{
      id: string;
      raw: string;
      _content: string;
    }>;
  };
  urls: {
    url: Array<{
      type: string;
      _content: string;
    }>;
  };
  license: string;
}

export interface FlickrSize {
  label: string;
  width: number;
  height: number;
  source: string;
  url: string;
  media: string;
}

export interface FlickrGroup {
  nsid: string;
  name: string;
  members: string;
  pool_count: string;
  topic_count?: string;
  privacy?: string;
  description?: { _content: string };
  throttle?: {
    mode: string;
    count?: string;
    remaining?: string;
  };
}

export interface FlickrComment {
  id: string;
  author: string;
  authorname: string;
  datecreate: string;
  permalink: string;
  _content: string;
}

export interface FlickrStatsPhoto {
  id: string;
  title: string | { _content: string };
  views: string;
  comments?: string;
  favorites?: string;
}
