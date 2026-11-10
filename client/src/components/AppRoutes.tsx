import { Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import Layout from './Layout';
import Login from '../pages/Login';
import Dashboard from '../pages/Dashboard';
import Tasks from '../pages/Tasks';
import TaskDetail from '../pages/TaskDetail';
import Directory from '../pages/Directory';
import MemberProfile from '../pages/MemberProfile';
import Messages from '../pages/Messages';
import OperationsBoard from '../pages/OperationsBoard';
import DocumentVault from '../pages/DocumentVault';
import Calendar from '../pages/Calendar';
import Announcements from '../pages/Announcements';
import Settings from '../pages/Settings';

export default function AppRoutes() {
  const user = useStore((s) => s.user);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          user ? <Layout /> : <Navigate to="/login" replace />
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/tasks/:id" element={<TaskDetail />} />
        <Route path="/directory" element={<Directory />} />
        <Route path="/directory/:id" element={<MemberProfile />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/messages/:channelId" element={<Messages />} />
        <Route path="/board" element={<OperationsBoard />} />
        <Route path="/documents" element={<DocumentVault />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/announcements" element={<Announcements />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
