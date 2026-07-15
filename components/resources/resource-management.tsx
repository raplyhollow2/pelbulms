// @ts-nocheck - Supabase type inference issues documented in TYPESCRIPT_ISSUES.md
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FileText,
  Image,
  Video,
  Music,
  Archive,
  Upload,
  Download,
  Share,
  Trash2,
  Eye,
  Edit,
  FolderPlus,
  Search,
  Filter,
  Grid3x3,
  List,
  Star,
  Clock,
  TrendingUp,
  Users,
  HardDrive,
  Lock,
  Globe,
  MoreVertical,
  Copy,
  FolderOpen,
  File,
  FileCode,
  FileType,
  Boxes,
  Package,
  CheckCircle2,
  AlertTriangle,
  RefreshCw
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

interface ResourceFile {
  id: string
  name: string
  type: 'document' | 'image' | 'video' | 'audio' | 'archive' | 'code' | 'other'
  size: number
  url: string
  thumbnail?: string
  metadata: {
    created_at: string
    updated_at: string
    created_by: string
    version: number
    is_public: boolean
    download_count: number
    tags: string[]
  }
  permissions: {
    can_view: string[]
    can_edit: string[]
    can_delete: string[]
  }
}

interface ResourceFolder {
  id: string
  name: string
  parent_id?: string
  created_at: string
  created_by: string
  resource_count: number
  size: number
  is_public: boolean
}

interface StorageStats {
  total_space: number
  used_space: number
  file_count: number
  folder_count: number
  shared_resources: number
  popular_files: ResourceFile[]
}

interface UploadProgress {
  file: File
  progress: number
  status: 'uploading' | 'completed' | 'error'
}

export function ResourceManagement() {
  const [activeTab, setActiveTab] = useState<'files' | 'upload' | 'shared' | 'stats'>('files')
  const [files, setFiles] = useState<ResourceFile[]>([])
  const [folders, setFolders] = useState<ResourceFolder[]>([])
  const [currentFolder, setCurrentFolder] = useState<ResourceFolder | null>(null)
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null)
  const [uploadQueue, setUploadQueue] = useState<UploadProgress[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [userRole, setUserRole] = useState<'student' | 'instructor' | 'admin'>('instructor')

  useEffect(() => {
    fetchFiles()
    fetchFolders()
    fetchStorageStats()
  }, [])

  const fetchFiles = async () => {
    const { data, error } = await supabase
      .from('resources')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setFiles(data as ResourceFile[])
    }
  }

  const fetchFolders = async () => {
    const { data, error } = await supabase
      .from('resource_folders')
      .select('*')
      .order('name', { ascending: true })

    if (!error && data) {
      setFolders(data as ResourceFolder[])
    }
  }

  const fetchStorageStats = async () => {
    // Mock storage stats
    setStorageStats({
      total_space: 10 * 1024 * 1024 * 1024, // 10GB
      used_space: 2.5 * 1024 * 1024 * 1024, // 2.5GB
      file_count: 234,
      folder_count: 15,
      shared_resources: 45,
      popular_files: []
    })
  }

  const handleFileUpload = async (fileList: FileList | null) => {
    if (!fileList) return

    const files = Array.from(fileList)

    files.forEach(file => {
      const uploadProgress: UploadProgress = {
        file,
        progress: 0,
        status: 'uploading'
      }

      setUploadQueue(prev => [...prev, uploadProgress])

      uploadFile(file, uploadProgress)
    })
  }

  const uploadFile = async (file: File, uploadProgress: UploadProgress) => {
    try {
      // Upload to Supabase Storage
      const fileName = `${Date.now()}-${file.name}`
      const { data, error } = await supabase.storage
        .from('resources')
        .upload(fileName, file)

      if (error) throw error

      // Create database record
      const { error: dbError } = await supabase
        .from('resources')
        .insert({
          name: file.name,
          type: getFileType(file.name, file.type),
          size: file.size,
          url: data.path,
          metadata: {
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: 'current-user',
            version: 1,
            is_public: false,
            download_count: 0,
            tags: []
          },
          permissions: {
            can_view: ['current-user'],
            can_edit: ['current-user'],
            can_delete: ['current-user']
          }
        })

      if (dbError) throw dbError

      // Update progress
      setUploadQueue(prev =>
        prev.map(item =>
          item.file.name === file.name
            ? { ...item, progress: 100, status: 'completed' }
            : item
        )
      )

      fetchFiles()
      fetchStorageStats()

      // Remove from queue after delay
      setTimeout(() => {
        setUploadQueue(prev =>
          prev.filter(item => item.file.name !== file.name)
        )
      }, 3000)

    } catch (error) {
      console.error('Upload failed:', error)

      setUploadQueue(prev =>
        prev.map(item =>
          item.file.name === file.name
            ? { ...item, status: 'error' }
            : item
        )
      )
    }
  }

  const getFileType = (fileName: string, mimeType: string): ResourceFile['type'] => {
    const ext = fileName.split('.').pop()?.toLowerCase()

    if (mimeType.startsWith('image/')) return 'image'
    if (mimeType.startsWith('video/')) return 'video'
    if (mimeType.startsWith('audio/')) return 'audio'

    if (ext === 'pdf' || ext === 'doc' || ext === 'docx' || ext === 'txt') return 'document'
    if (ext === 'zip' || ext === 'rar' || ext === '7z') return 'archive'
    if (['js', 'py', 'java', 'cpp', 'html', 'css'].includes(ext || '')) return 'code'

    return 'other'
  }

  const getFileIcon = (type: ResourceFile['type']) => {
    switch (type) {
      case 'document': return <FileText className="w-5 h-5" />
      case 'image': return <Image className="w-5 h-5" />
      case 'video': return <Video className="w-5 h-5" />
      case 'audio': return <Music className="w-5 h-5" />
      case 'archive': return <Archive className="w-5 h-5" />
      case 'code': return <FileCode className="w-5 h-5" />
      default: return <FileType className="w-5 h-5" />
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
  }

  const createFolder = async (folderName: string) => {
    const newFolder: Partial<ResourceFolder> = {
      name: folderName,
      parent_id: currentFolder?.id,
      created_at: new Date().toISOString(),
      created_by: 'current-user',
      resource_count: 0,
      size: 0,
      is_public: false
    }

    const { error } = await supabase
      .from('resource_folders')
      .insert(newFolder)

    if (!error) {
      fetchFolders()
    }
  }

  const deleteFile = async (fileId: string) => {
    const { error } = await supabase
      .from('resources')
      .delete()
      .eq('id', fileId)

    if (!error) {
      setFiles(prev => prev.filter(file => file.id !== fileId))
      fetchStorageStats()
    }
  }

  const shareFile = async (fileId: string, userEmails: string[]) => {
    // Implement file sharing logic
    console.log('Sharing file', fileId, 'with', userEmails)
  }

  const filteredFiles = files.filter(file =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    file.metadata.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Resource Management</h2>
          <p className="text-gray-600 dark:text-gray-400">Store, organize, and share educational resources</p>
        </div>
        <Badge variant="secondary" className="flex items-center gap-1">
          <HardDrive className="w-3 h-3" />
          {storageStats ? formatFileSize(storageStats.used_space) : '0 GB'} used
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="files">
            <FolderOpen className="w-4 h-4 mr-2" />
            Files
          </TabsTrigger>
          <TabsTrigger value="upload">
            <Upload className="w-4 h-4 mr-2" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="shared">
            <Share className="w-4 h-4 mr-2" />
            Shared
          </TabsTrigger>
          <TabsTrigger value="stats">
            <TrendingUp className="w-4 h-4 mr-2" />
            Stats
          </TabsTrigger>
        </TabsList>

        {/* Files Tab */}
        <TabsContent value="files" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>My Resources</CardTitle>
                  <CardDescription>
                    {filteredFiles.length} files • {folders.length} folders
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}>
                    {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid3x3 className="w-4 h-4" />}
                  </Button>
                  <Button size="sm" variant="outline">
                    <FolderPlus className="w-4 h-4 mr-1" />
                    New Folder
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Search and Filter */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search files and folders..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="document">Documents</SelectItem>
                      <SelectItem value="image">Images</SelectItem>
                      <SelectItem value="video">Videos</SelectItem>
                      <SelectItem value="audio">Audio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Folders */}
                {folders.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-2">Folders</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {folders.map(folder => (
                        <div
                          key={folder.id}
                          className="p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                          onClick={() => setCurrentFolder(folder)}
                        >
                          <div className="flex items-center gap-3">
                            <FolderOpen className="w-8 h-8 text-blue-600" />
                            <div>
                              <p className="font-medium truncate">{folder.name}</p>
                              <p className="text-sm text-gray-500">
                                {folder.resource_count} items
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Files */}
                <div>
                  <h3 className="text-sm font-medium mb-2">Files</h3>
                  {viewMode === 'grid' ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {filteredFiles.map(file => (
                        <div
                          key={file.id}
                          className="group relative p-4 border rounded-lg hover:shadow-md transition-all cursor-pointer"
                          onClick={() => setSelectedFiles([file.id])}
                        >
                          <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded mb-3 flex items-center justify-center">
                            {file.type === 'image' && file.thumbnail ? (
                              <img src={file.thumbnail} alt={file.name} className="w-full h-full object-cover rounded" />
                            ) : (
                              <div className="text-4xl text-gray-400">
                                {getFileIcon(file.type)}
                              </div>
                            )}
                          </div>
                          <p className="font-medium truncate text-sm">{file.name}</p>
                          <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>

                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredFiles.map(file => (
                        <div
                          key={file.id}
                          className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                        >
                          <div className="text-gray-600">
                            {getFileIcon(file.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{file.name}</p>
                            <p className="text-sm text-gray-500">
                              {formatFileSize(file.size)} • {new Date(file.metadata.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost">
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost">
                              <Share className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Upload Tab */}
        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Upload Files</CardTitle>
              <CardDescription>
                Drag and drop files or click to browse
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-12 text-center">
                <input
                  type="file"
                  multiple
                  onChange={(e) => handleFileUpload(e.target.files)}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium">Drop files here or click to browse</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Supports: Documents, Images, Videos, Audio, Archives, Code files
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Maximum file size: 500MB
                  </p>
                </label>
              </div>

              {/* Upload Queue */}
              {uploadQueue.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold">Upload Progress</h3>
                  {uploadQueue.map((item, index) => (
                    <div key={index} className="p-4 border rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileType className="w-4 h-4" />
                          <span className="font-medium truncate">{item.file.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.status === 'uploading' && (
                            <span className="text-sm text-gray-500">{item.progress}%</span>
                          )}
                          {item.status === 'completed' && (
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                          )}
                          {item.status === 'error' && (
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                          )}
                        </div>
                      </div>
                      <Progress value={item.progress} className="h-2" />
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <span>{formatFileSize(item.file.size)}</span>
                        {item.status === 'uploading' && (
                          <span>Uploading...</span>
                        )}
                        {item.status === 'completed' && (
                          <span className="text-green-600">Completed</span>
                        )}
                        {item.status === 'error' && (
                          <span className="text-red-600">Failed - Retry</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Shared Resources Tab */}
        <TabsContent value="shared">
          <Card>
            <CardHeader>
              <CardTitle>Shared Resources</CardTitle>
              <CardDescription>
                Files shared with you and files you've shared with others
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center text-gray-500 py-8">
                <Share className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No shared resources yet</p>
                <p className="text-sm mt-1">Share files with others to collaborate</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Statistics Tab */}
        <TabsContent value="stats" className="space-y-4">
          {storageStats && (
            <>
              <div className="grid md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatFileSize(storageStats.used_space)}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      of {formatFileSize(storageStats.total_space)} total
                    </p>
                    <Progress
                      value={(storageStats.used_space / storageStats.total_space) * 100}
                      className="mt-2 h-2"
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Total Files</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{storageStats.file_count}</div>
                    <p className="text-xs text-gray-500 mt-1">
                      Across {storageStats.folder_count} folders
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Shared Resources</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{storageStats.shared_resources}</div>
                    <p className="text-xs text-gray-500 mt-1">
                      Active collaborations
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Available Space</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatFileSize(storageStats.total_space - storageStats.used_space)}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Free storage remaining
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Storage Breakdown</CardTitle>
                  <CardDescription>Distribution by file type</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { type: 'Documents', count: 45, size: 1.2, color: 'bg-blue-500' },
                      { type: 'Images', count: 89, size: 0.8, color: 'bg-green-500' },
                      { type: 'Videos', count: 23, size: 0.3, color: 'bg-purple-500' },
                      { type: 'Audio', count: 12, size: 0.1, color: 'bg-orange-500' },
                      { type: 'Other', count: 65, size: 0.1, color: 'bg-gray-500' }
                    ].map(category => (
                      <div key={category.type}>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm">{category.type}</span>
                          <span className="text-sm text-gray-500">
                            {category.count} files • {formatFileSize(category.size * 1024 * 1024 * 1024)}
                          </span>
                        </div>
                        <Progress value={(category.size / 2.5) * 100} className="h-2" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Upload Queue Overlay */}
      {uploadQueue.length > 0 && (
        <Alert className="fixed bottom-4 right-4 max-w-md">
          <Upload className="h-4 w-4" />
          <AlertDescription>
            {uploadQueue.filter(item => item.status === 'completed').length} of {uploadQueue.length} files uploaded successfully
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}