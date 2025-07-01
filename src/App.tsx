import { Routes, Route, Navigate } from 'react-router-dom'
import { Profile, UpdateProfile, CallHistory, Home } from './_root/pages'
import './globals.css'
import SigninForm from './_auth/forms/SigninForm'
import AuthLayout from './_auth/AuthLayout'
import RootLayout from './_root/RootLayout'
import { Toaster } from "@/components/ui/toaster"
import ChangePasswordForm from './_auth/forms/ChangePasswordForm'
import AuthGuard from './components/shared/AuthGuard'
import { useEffect, useState } from 'react'
import { initializeDefaultMinistry, updateUserOnlineStatus } from './lib/appwrite/api'
import { useUserContext } from './context/AuthContext'
import { appwriteSignalingService } from './lib/webrtc/appwriteSignaling'
import { BaseSignalMessage } from './lib/webrtc/signalingTypes'
import ImprovedVoiceCallModal from './components/chat/ImprovedVoiceCallModal'


const App = () => {
  const { user } = useUserContext();
  const [incomingCall, setIncomingCall] = useState<{
    from: string;
    fromName: string;
    offer: RTCSessionDescriptionInit;
  } | null>(null);

  // 监听来电
  useEffect(() => {
    if (!user.$id) return;

    const handleSignalingMessage = (message: BaseSignalMessage) => {
      console.log('📞 App.tsx 收到信令消息:', message);
      
      if (message.type === 'offer' && message.to === user.$id && message.payload.sdp) {
        setIncomingCall({
          from: message.from,
          fromName: message.payload.callerName || '未知用户',
          offer: message.payload as RTCSessionDescriptionInit
        });
      }
    };

    // 注册信令监听
    appwriteSignalingService.registerUser(user.$id, handleSignalingMessage);

    // 初始化默认事工
    initializeDefaultMinistry().catch(console.error);

    return () => {
      if (user.$id) {
        appwriteSignalingService.unregisterUser(user.$id, handleSignalingMessage);
      }
    };
  }, [user.$id]);

  // 更新用户在线状态
  useEffect(() => {
    if (!user.$id) return;

    // 1. 用户进入应用，标记为在线
    updateUserOnlineStatus(user.$id, true);

    // 2. 用户关闭浏览器，标记为离线
    const handleBeforeUnload = () => {
      console.log(`[APP_UNLOAD] beforeunload event triggered for user ${user.$id}. Attempting to set status to offline.`);
      // 注意：这里的调用可能不会100%成功，因为浏览器会限制unload事件中的异步操作
      // 但这是目前最可行的常规Web方案
      updateUserOnlineStatus(user.$id, false);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // 3. 组件卸载/用户ID变化，标记为离线
    return () => {
      console.log(`[APP_UNLOAD] useEffect cleanup for ${user.$id}. Attempting to set status to offline.`);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      updateUserOnlineStatus(user.$id, false);
    };
  }, [user.$id]);

  return (
    <main className='flex h-screen'>
      <Routes>
        {/* public routes */}
        <Route element={<AuthLayout />}>
          <Route path="/sign-in" element={<SigninForm />} />
          <Route path="/change-password" element={<ChangePasswordForm />} />
        </Route>

        {/* private routes */}
        <Route element={<AuthGuard><RootLayout /></AuthGuard>}>
          <Route index element={<Home />} />
          <Route path="/home" element={<Home />} />
          <Route path="/profile/:id/*" element={<Profile />} />
          <Route path="/update-profile/:id" element={<UpdateProfile />} />
          <Route path="/change-password" element={<ChangePasswordForm />} />
          <Route path="/call-history" element={<CallHistory />} />
          <Route path="/chat" element={<Home />} />
        </Route>
      </Routes>

      {/* 全局来电通知模态框 */}
      {incomingCall && (
        <ImprovedVoiceCallModal
          isOpen={true}
          onClose={() => setIncomingCall(null)}
          targetUser={{
            id: incomingCall.from,
            name: incomingCall.fromName,
            avatar: undefined
          }}
          mode="incoming"
          incomingOffer={incomingCall.offer}
        />
      )}
      <Toaster />
    </main>
  )
}

export default App