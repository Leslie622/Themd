import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { platformServices } from '@/app/platform'
import { useEditorPrefs } from '@/store-editor'
import { ChevronDown, Eye, EyeOff, XIcon } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'

/**
 * 图床配置弹窗:服务商选择 + 凭据字段 + 测试上传(传 1px PNG 探活)。
 * 字段实时写入偏好 store(即改即持久化),与原设置页内联面板行为一致。
 */
function UploaderConfigDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const provider = useEditorPrefs((s) => s.uploaderProvider)
  const githubRepo = useEditorPrefs((s) => s.githubRepo)
  const githubToken = useEditorPrefs((s) => s.githubToken)
  const picgoUrl = useEditorPrefs((s) => s.picgoUrl)
  const setUploader = useEditorPrefs((s) => s.setUploader)
  const [testing, setTesting] = useState(false)

  const runTest = () => {
    setTesting(true)
    platformServices.uploader
      .test({ provider, githubRepo, githubToken, picgoUrl })
      .then((url) => toast.success(`测试上传成功:${url}`))
      .catch((e) => toast.error(e instanceof Error ? e.message : '测试上传失败'))
      .finally(() => setTesting(false))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* 紧凑 header:vega 默认关闭按钮按 p-6 header 定位(top-4),放这里会
          跨过 border-b 错位,故 showCloseButton=false + 官方 DialogClose 放标题行内 */}
      <DialogContent showCloseButton={false} className="flex max-w-md flex-col gap-0 p-0 sm:max-w-md">
        <DialogHeader className="flex-row items-center justify-between border-b py-2.5 pr-2 pl-4">
          <DialogTitle className="text-sm">图床配置</DialogTitle>
          <DialogClose asChild>
            <Button variant="ghost" size="icon-sm" aria-label="关闭">
              <XIcon />
            </Button>
          </DialogClose>
          <DialogDescription className="sr-only">
            选择图床服务商并填写凭据,可测试上传
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] text-muted-foreground">服务商</span>
            <Select
              value={provider}
              onValueChange={(v) => setUploader({ uploaderProvider: v as typeof provider })}
            >
              <SelectTrigger size="sm" className="w-full" aria-label="图床服务商">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="github">GitHub 仓库</SelectItem>
                  <SelectItem value="picgo">PicGo 本地桥</SelectItem>
                </SelectGroup>
          </SelectContent>
            </Select>
          </div>
          {provider === 'github' && (
            <>
              <UploaderInput
                label="仓库"
                value={githubRepo}
                onChange={(v) => setUploader({ githubRepo: v })}
                placeholder="owner/repo"
              />
              <UploaderInput
                label="Token"
                value={githubToken}
                onChange={(v) => setUploader({ githubToken: v })}
                placeholder="需 Contents 读写权限"
                secret
              />
            </>
          )}
          {provider === 'picgo' && (
            <UploaderInput
              label="接口"
              value={picgoUrl}
              onChange={(v) => setUploader({ picgoUrl: v })}
              placeholder="http://127.0.0.1:36677/upload"
            />
          )}
          <Button variant="outline" size="sm" disabled={testing} onClick={runTest}>
            {testing && <Spinner data-icon="inline-start" />}
            {testing ? '上传中…' : '测试上传'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** 图床配置字段:标签在上、输入框全宽在下;secret 用眼睛图标切换明文 */
function UploaderInput({
  label,
  value,
  onChange,
  placeholder,
  secret,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  secret?: boolean
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <div className="relative">
        <Input
          className="h-8 w-full pr-9 text-sm"
          type={secret && !show ? 'password' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
        />
        {secret && (
          <Button
            variant="ghost"
            size="icon-xs"
            // inset-y-0 my-auto 垂直居中:不能用 top-1/2 -translate-y-1/2,
            // 否则与 Button 基类的 active:translate-y-px 按压反馈打架,
            // 按下时 -50% 居中偏移被覆盖,按钮会整颗掉下去
            className="absolute inset-y-0 right-1 my-auto"
            aria-label={show ? `隐藏${label}` : `显示${label}`}
            onClick={() => setShow((s) => !s)}
          >
            {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * 图床配置字段:设置页仅放一个仿 SelectTrigger 的触发器回显当前配置,
 * 具体配置(服务商/凭据/测试)收进弹窗——观感对齐 FontField 的槽位模式。
 */
export function UploaderField() {
  const [open, setOpen] = useState(false)
  const provider = useEditorPrefs((s) => s.uploaderProvider)
  const githubRepo = useEditorPrefs((s) => s.githubRepo)

  const display =
    provider === 'github'
      ? `GitHub · ${githubRepo.trim() || '未配置'}`
      : 'PicGo 本地桥'

  return (
    <>
      {/* 官方 Button(outline/sm)组合成「打开弹窗的类 Select 触发器」,与
          SettingsSheet 其余 h-8 选择控件一致;不手写尺寸(换风格会漂移) */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-[10.5rem] justify-between font-normal"
        aria-label="图床配置"
        onClick={() => setOpen(true)}
      >
        <span className="truncate">{display}</span>
        <ChevronDown className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
      </Button>
      <UploaderConfigDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
