/** 图床配置:三服务商各自的凭据字段,与 store-editor 的偏好字段一一对应 */
export interface UploaderConfig {
  provider: 'smms' | 'github' | 'picgo'
  smmsToken: string
  githubRepo: string
  githubToken: string
  picgoUrl: string
}

/** 单张图片上传结果 */
export interface UploadedImage {
  /** 外链 URL(正文里 ![alt](url) 直接引用) */
  url: string
  /** 服务商侧的删除/管理地址,可空(SM.MS 有,GitHub 无) */
  deleteUrl?: string
}

export interface UploaderGateway {
  /**
   * 上传一张图片。实现方负责:
   * - SM.MS: POST https://sm.ms/api/v2/upload (Authorization 头) → image/url
   * - GitHub: PUT repos/{repo}/contents/assets/{name} → content.download_url
   * - PicGo: POST {picgoUrl} {list:[{base64,fileName}]} → result[0]
   * @param filename 建议的服务商侧文件名(含扩展名),实现可改写
   * @throws 配置缺失、网络失败或业务码非成功时抛出可读错误
   */
  upload(config: UploaderConfig, bytes: Uint8Array, filename: string): Promise<UploadedImage>
  /** 用当前配置传一张 1px PNG 探活,返回可访问的 URL;配置缺失时抛错 */
  test(config: UploaderConfig): Promise<string>
}
