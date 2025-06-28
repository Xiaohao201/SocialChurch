import { INewPost, INewUser, IUpdatePost, IUser, INotification, IUserWithFriendship } from '@/types'
import { IFriend } from '@/types';
import {
    useQuery,
    useMutation,
    useQueryClient,
    useInfiniteQuery,
    QueryClient,
    InfiniteData
}   from '@tanstack/react-query'
import { createUserAccount, signInAccount, signOutAccount, createPost, getRecentPosts, likePost, savePost, deleteSavedPost, getCurrentUser, getPostById, updatePost, deletePost, getInfinitePosts, searchPosts, updateUser, getUserOnlineStatus, updateUserOnlineStatus, getFriendRequests, getFriends, handleFriendRequest, removeFriend, searchUsers, sendFriendRequest, getUserNotifications, markUserNotificationAsRead, markAllUserNotificationsAsRead } from '../appwrite/api'
import { QUERY_KEYS } from './queryKeys'
import { PostValidation } from '../validation'
import { string } from 'zod'
import { Models } from 'appwrite'
import { polishTestimony, suggestReply, recommendFriends } from '@/lib/deepseek/api'
import { ChatMessage } from '@/lib/deepseek/config'

export const useCreateUserAccount = () => {
    return useMutation({
        mutationFn: (user: INewUser) => createUserAccount(user)
    })
}

export const useSignInAccount = () => {
    return useMutation({
        mutationFn: (user: { email: string; password: string; }) => signInAccount(user)
    })
}

export const useSignOutAccount = () => {
    return useMutation({
        mutationFn: signOutAccount
    })
}

export const useCreatePost = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (post: INewPost) => createPost({
            ...post,
            location: post.location || "",
            tags: post.tags || "",
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.GET_RECENT_POSTS]
            });
        }
    });
}

export const useGetRecentPosts = () => {
    return useQuery({
        queryKey: [QUERY_KEYS.GET_RECENT_POSTS],
        queryFn: getRecentPosts,
    })
}

export const useLikePost = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ postId, likesArray }: { postId: string; likesArray: 
            string[] }) => likePost(postId, likesArray),
            onSuccess: (data) => {
                queryClient.invalidateQueries({
                    queryKey: [QUERY_KEYS.GET_POST_BY_ID, data?.$id]
                })
                queryClient.invalidateQueries({
                    queryKey: [QUERY_KEYS.GET_RECENT_POSTS]
                })

                queryClient.invalidateQueries({
                    queryKey: [QUERY_KEYS.GET_POSTS]
                })

                queryClient.invalidateQueries({
                    queryKey: [QUERY_KEYS.GET_CURRENT_USER]
                })
            }
    })
}

export const useSavePost = () => {
    const queryClient = useQueryClient();
    let postIdForInvalidation: string | undefined;

    return useMutation({
        mutationFn: ({ postId, userId }: { postId: string; userId: 
            string }) => {
            postIdForInvalidation = postId;
            return savePost(postId, userId);
        },
        onSuccess: (savedDocumentData) => {
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.GET_POST_BY_ID, postIdForInvalidation]
            });
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.GET_RECENT_POSTS]
            });

            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.GET_POSTS]
            });

            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.GET_CURRENT_USER]
            });
        }
    })
}

export const useDeleteSavedPost = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ( savedRecordId: string) => deleteSavedPost(savedRecordId),
            onSuccess: () => {
                queryClient.invalidateQueries({
                    queryKey: [QUERY_KEYS.GET_RECENT_POSTS]
                })

                queryClient.invalidateQueries({
                    queryKey: [QUERY_KEYS.GET_POSTS]
                })

                queryClient.invalidateQueries({
                    queryKey: [QUERY_KEYS.GET_CURRENT_USER]
                })
            }
    })
}


export const useGetCurrentUser = () => {
    return useQuery({
        queryKey: [QUERY_KEYS.GET_CURRENT_USER],
        queryFn: getCurrentUser
    })
}

export const useGetPostById = (postId: string) => {
    return useQuery({
        queryKey: [QUERY_KEYS.GET_POST_BY_ID, postId],
        queryFn: () => getPostById(postId),
        enabled: !!postId
    })
}

export const useUpdatePost = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (post: IUpdatePost) => updatePost(post),
        onSuccess: (data) => {
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.GET_POST_BY_ID, data?.$id]
            })
        }
    })
}

export const useDeletePost = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ postId, imageId }: { postId: string, imageId: 
            string}) =>  deletePost(postId, imageId),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.GET_RECENT_POSTS]
            })
        }
    })
}

export const useGetPosts = () => {
    return useInfiniteQuery<
        Models.DocumentList<Models.Document>,
        Error,
        InfiniteData<Models.DocumentList<Models.Document>, string | undefined>,
        [QUERY_KEYS],
        string | undefined
    >({
        queryKey: [QUERY_KEYS.GET_INFINITE_POSTS],
        queryFn: ({ pageParam }) => getInfinitePosts({ pageParam }),
        initialPageParam: undefined,
        getNextPageParam: (lastPage, _allPages) => {
            if (!lastPage || lastPage.documents.length === 0) {
                return undefined;
            }
            return lastPage.documents[lastPage.documents.length - 1].$id;
        },
    });
}

export const useSearchPosts = (searchTerm: string) => {
    return useQuery<
        Models.DocumentList<Models.Document>,
        Error,
        Models.DocumentList<Models.Document>,
        [QUERY_KEYS, string]
    >({
        queryKey: [QUERY_KEYS.SEARCH_POSTS, searchTerm],
        queryFn: () => searchPosts(searchTerm),
        enabled: !!searchTerm,
    });
}

// 获取用户在线状态
export const useGetUserOnlineStatus = (userId: string) => {
  return useQuery({
    queryKey: [QUERY_KEYS.GET_USER_ONLINE_STATUS, userId],
    queryFn: () => getUserOnlineStatus(userId),
    refetchInterval: 30000, // 每30秒刷新一次
  });
};

// 更新用户在线状态
export const useUpdateUserOnlineStatus = () => {
  return useMutation({
    mutationFn: ({ userId, isOnline }: { userId: string; isOnline: boolean }) =>
      updateUserOnlineStatus(userId, isOnline),
  });
};

// 获取好友请求列表
export const useGetFriendRequests = (userId: string) => {
  return useQuery({
    queryKey: [QUERY_KEYS.GET_FRIEND_REQUESTS, userId],
    queryFn: () => getFriendRequests(userId),
  });
};

// 发送好友请求
export const useSendFriendRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ senderId, receiverId, message }: { senderId: string; receiverId: string; message?: string }) =>
      sendFriendRequest(senderId, receiverId, message),
    onSuccess: (data, variables) => {
      // 更温和地更新缓存，避免完全重新加载搜索结果
      // 可以选择性地更新特定查询，而不是使所有搜索查询无效
      // queryClient.invalidateQueries({
      //   queryKey: [QUERY_KEYS.SEARCH_USERS],
      // });
      
      // 仅在需要时更新特定的查询
      console.log('好友请求发送成功，receiverId:', variables.receiverId);
    },
  });
};

// 处理好友请求
export const useHandleFriendRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ requestId, status, userId }: { requestId: string; status: 'accepted' | 'rejected'; userId: string }) =>
      handleFriendRequest(requestId, status, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.GET_FRIEND_REQUESTS],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.GET_FRIENDS],
      });
    },
  });
};

// 获取好友列表
export const useGetFriends = (userId: string) => {
  return useQuery({
    queryKey: [QUERY_KEYS.GET_FRIENDS, userId],
    queryFn: async () => {
      const data = await getFriends(userId);
      return data.map(friend => ({
        $id: friend.$id,
        id: friend.$id,
        email: friend.email,
        name: friend.name,
        username: friend.username,
        imageUrl: friend.imageUrl,
        gender: friend.gender,
        dateOfFaith: friend.dateOfFaith,
        faithTestimony: friend.faithTestimony,
        interests: friend.interests,
        ministry: friend.ministry,
        ministryId: friend.ministryId || '',
        accountId: friend.accountId || '',
        status: friend.status,
        mustChangePassword: friend.mustChangePassword,
        isOnline: friend.isOnline,
        lastSeen: friend.lastSeen,
        friendshipId: friend.friendshipId
      })) as IUserWithFriendship[];
    }
  });
};

// 搜索用户
export const useSearchUsers = (keyword: string, currentUserId: string) => {
  return useQuery({
    queryKey: [QUERY_KEYS.SEARCH_USERS, keyword, currentUserId],
    queryFn: () => searchUsers(keyword, currentUserId),
    enabled: keyword.length >= 2, // 至少2个字符才开始搜索
    staleTime: 2 * 60 * 1000, // 2分钟内数据被认为是新鲜的
    retry: 2, // 失败后重试2次
    refetchOnWindowFocus: false, // 窗口获得焦点时不重新获取
  });
};

// 移除好友
export const useRemoveFriend = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeFriend,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.GET_FRIENDS],
      });
    },
  });
};

// 获取通知列表
export const useGetNotifications = (userId: string) => {
  return useQuery<INotification[]>({
    queryKey: [QUERY_KEYS.GET_NOTIFICATIONS, userId],
    queryFn: () => getUserNotifications(userId),
  });
};

// 获取未读通知数量
export const useGetUnreadNotificationsCount = (userId: string) => {
  const { data: notifications } = useGetNotifications(userId);
  return {
    unreadCount: notifications?.filter((notification: any) => !notification.isRead).length || 0,
  };
};

// 标记通知为已读
export const useMarkNotificationAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markUserNotificationAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.GET_NOTIFICATIONS],
      });
    },
  });
};

// 标记所有通知为已读
export const useMarkAllNotificationsAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markAllUserNotificationsAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.GET_NOTIFICATIONS],
      });
    },
  });
};

// AI 功能
export const usePolishTestimony = () => {
  return useMutation({
    mutationFn: polishTestimony,
  });
};

export const useSuggestReply = () => {
  return useMutation({
    mutationFn: (context: {
      previousMessages: ChatMessage[];
      lastMessage: string;
      relationship: string;
      userFaith: string;
    }) => suggestReply(context),
  });
};

export const useRecommendFriends = () => {
  return useMutation({
    mutationFn: ({
      userProfile,
      potentialFriends,
    }: {
      userProfile: {
        testimony: string;
        interests: string[];
        ministry?: string;
      };
      potentialFriends: Array<{
        id: string;
        name: string;
        testimony: string;
        interests: string[];
        ministry?: string;
      }>;
    }) => recommendFriends(userProfile, potentialFriends),
  });
};

// 添加 useUpdateUser hook
export const useUpdateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, userData }: { userId: string; userData: Partial<IUser> }) => {
      const updatedUser = await updateUser(userId, userData);
      return updatedUser;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.GET_CURRENT_USER]
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.GET_USER_BY_ID, data?.$id]
      });
    }
  });
};