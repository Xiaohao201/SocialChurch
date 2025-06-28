export enum QUERY_KEYS {
    // AUTH KEYS
    CREATE_USER_ACCOUNT = "createUserAccount",
  
    // USER KEYS
    GET_CURRENT_USER = "getCurrentUser",
    GET_USERS = "getUsers",
    GET_USER_BY_ID = "getUserById",
  
    // POST KEYS
    GET_POSTS = "getPosts",
    GET_INFINITE_POSTS = "getInfinitePosts",
    GET_RECENT_POSTS = "getRecentPosts",
    GET_POST_BY_ID = "getPostById",
    GET_USER_POSTS = "getUserPosts",
    GET_FILE_PREVIEW = "getFilePreview",
  
    //  SEARCH KEYS
    SEARCH_POSTS = "getSearchPosts",
  
    // USER STATUS
    GET_USER_ONLINE_STATUS = "GET_USER_ONLINE_STATUS",
  
    // FRIEND KEYS
    GET_FRIEND_REQUESTS = "GET_FRIEND_REQUESTS",
    GET_FRIENDS = "GET_FRIENDS",
    SEARCH_USERS = "SEARCH_USERS",
  
    // NOTIFICATION KEYS
    GET_NOTIFICATIONS = "GET_NOTIFICATIONS",
    GET_UNREAD_NOTIFICATIONS_COUNT = "GET_UNREAD_NOTIFICATIONS_COUNT",
  }