# 稳定错误码

| 错误码 | HTTP | 用户动作 |
|---|---:|---|
| `UNAUTHORIZED` | 401 | 重新登录 |
| `INVALID_CREDENTIALS` | 401 | 检查账号密码 |
| `PROJECT_NOT_FOUND` | 404 | 返回自己的项目列表 |
| `CANVAS_VERSION_CONFLICT` | 409 | 重新同步画布 |
| `CONFIRMATION_NOT_FOUND` | 404 | 重新发起操作 |
| `CONFIRMATION_EXPIRED` | 409 | 重新确认 |
| `APP_RATE_LIMITED` | 429 | 稍后重试 |
| `BAILIAN_RATE_LIMITED` | 429 | 稍后重试 |
| `BAILIAN_AUTH_ERROR` | 503 | 联系管理员检查服务端配置 |
| `BAILIAN_TIMEOUT` | 503 | 重试 |
| `BAILIAN_INVALID_RESPONSE` | 503 | 重新提交 |
| `BAILIAN_UNAVAILABLE` | 503 | 稍后重试 |
| `INVALID_IMAGE_DATA_URL` | 400 | 更换图片 |
| `INVALID_IMAGE_BYTES` | 400 | 更换图片 |
| `IMAGE_DECODE_FAILED` | 400 | 更换图片 |
| `REFERENCE_IMAGE_LIMIT` | 400 | 保留最多三张初始参考图 |
| `IMAGE_SELECTION_LIMIT` | 400 | 保留最多八张选择 |
| `EMPTY_REGION` | 400 | 重新框选 |
| `GENERATION_NOT_RETRYABLE` | 409 | 选择失败任务 |

所有错误响应包含短 `requestId`，不包含密钥、系统提示词、内部堆栈或隐藏推理。
