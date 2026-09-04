<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { Iphone, Message, User } from '@element-plus/icons-vue'

interface SignupForm {
  name: string
  email: string
  phone: string
  gender: string
  city: string
  role: string
  interests: string[]
  birthday: string
  arriveAt: string
  companions: number
  notify: boolean
  expectation: number
  budget: number
  note: string
  agree: boolean
}

const formRef = ref<FormInstance>()
const submitted = ref<SignupForm | null>(null)

const form = reactive<SignupForm>({
  name: '',
  email: '',
  phone: '',
  gender: '',
  city: '',
  role: '',
  interests: [],
  birthday: '',
  arriveAt: '',
  companions: 1,
  notify: true,
  expectation: 3,
  budget: 200,
  note: '',
  agree: false,
})

const rules = reactive<FormRules<SignupForm>>({
  name: [{ required: true, message: '请填写姓名', trigger: 'blur' }],
  email: [
    { required: true, message: '请填写邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入正确的邮箱', trigger: 'blur' },
  ],
  phone: [
    { required: true, message: '请填写手机号', trigger: 'blur' },
    { pattern: /^1\d{10}$/, message: '请输入 11 位手机号', trigger: 'blur' },
  ],
  gender: [{ required: true, message: '请选择性别', trigger: 'change' }],
  city: [{ required: true, message: '请选择城市', trigger: 'change' }],
  role: [{ required: true, message: '请选择岗位', trigger: 'change' }],
  interests: [
    {
      type: 'array',
      required: true,
      min: 1,
      message: '请至少选择一项兴趣',
      trigger: 'change',
    },
  ],
  birthday: [{ required: true, message: '请选择出生日期', trigger: 'change' }],
  arriveAt: [{ required: true, message: '请选择到场时间', trigger: 'change' }],
  agree: [
    {
      validator: (_rule, value: boolean, callback) => {
        if (!value) {
          callback(new Error('请先同意活动须知'))
          return
        }
        callback()
      },
      trigger: 'change',
    },
  ],
})

const cities = ['北京', '上海', '广州', '深圳', '杭州', '成都']
const roles = ['产品', '设计', '研发', '测试', '运营', '其他']
const interestOptions = ['前端', '后端', 'AI', '设计', '产品']

async function submitForm() {
  if (!formRef.value) {
    return
  }

  try {
    await formRef.value.validate()
    submitted.value = { ...form, interests: [...form.interests] }
    ElMessage.success('报名已提交')
  } catch {
    submitted.value = null
    ElMessage.error('请先修正表单错误')
  }
}

function resetForm() {
  formRef.value?.resetFields()
  submitted.value = null
}
</script>

<template>
  <div class="form-scene" data-scene="form">
    <el-card shadow="never" class="form-card">
      <template #header>
        <div class="card-header">
          <span>技术沙龙报名</span>
          <el-tag type="info" size="small">表单演练</el-tag>
        </div>
      </template>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="108px"
        status-icon
        @submit.prevent="submitForm"
      >
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="姓名" prop="name">
              <el-input
                id="name"
                v-model="form.name"
                name="name"
                maxlength="20"
                clearable
                placeholder="请输入姓名"
                :prefix-icon="User"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="邮箱" prop="email">
              <el-input
                id="email"
                v-model="form.email"
                name="email"
                type="email"
                clearable
                placeholder="name@example.com"
                :prefix-icon="Message"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="手机号" prop="phone">
              <el-input
                id="phone"
                v-model="form.phone"
                name="phone"
                maxlength="11"
                clearable
                placeholder="11 位手机号"
                :prefix-icon="Iphone"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="性别" prop="gender">
              <el-radio-group id="gender" v-model="form.gender" name="gender">
                <el-radio value="男">男</el-radio>
                <el-radio value="女">女</el-radio>
                <el-radio value="其他">其他</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="城市" prop="city">
              <el-select
                id="city"
                v-model="form.city"
                name="city"
                clearable
                placeholder="请选择城市"
                style="width: 100%"
              >
                <el-option
                  v-for="city in cities"
                  :key="city"
                  :label="city"
                  :value="city"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="岗位" prop="role">
              <el-select
                id="role"
                v-model="form.role"
                name="role"
                clearable
                placeholder="请选择岗位"
                style="width: 100%"
              >
                <el-option
                  v-for="role in roles"
                  :key="role"
                  :label="role"
                  :value="role"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="兴趣方向" prop="interests">
          <el-checkbox-group id="interests" v-model="form.interests" name="interests">
            <el-checkbox
              v-for="item in interestOptions"
              :key="item"
              :label="item"
              :value="item"
            />
          </el-checkbox-group>
        </el-form-item>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="出生日期" prop="birthday">
              <el-date-picker
                id="birthday"
                v-model="form.birthday"
                name="birthday"
                type="date"
                placeholder="选择日期"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="到场时间" prop="arriveAt">
              <el-time-picker
                id="arriveAt"
                v-model="form.arriveAt"
                name="arriveAt"
                placeholder="选择时间"
                format="HH:mm"
                value-format="HH:mm"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="同行人数" prop="companions">
              <el-input-number
                id="companions"
                v-model="form.companions"
                name="companions"
                :min="1"
                :max="8"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="接收通知" prop="notify">
              <el-switch id="notify" v-model="form.notify" name="notify" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="期待程度" prop="expectation">
          <el-rate id="expectation" v-model="form.expectation" show-score />
        </el-form-item>

        <el-form-item label="预算" prop="budget">
          <el-slider
            id="budget"
            v-model="form.budget"
            :min="0"
            :max="1000"
            :step="50"
            show-input
          />
        </el-form-item>

        <el-form-item label="备注" prop="note">
          <el-input
            id="note"
            v-model="form.note"
            name="note"
            type="textarea"
            :rows="3"
            maxlength="200"
            show-word-limit
            placeholder="可填写饮食禁忌、座位偏好等"
          />
        </el-form-item>

        <el-form-item prop="agree">
          <el-checkbox id="agree" v-model="form.agree" name="agree">
            我已阅读并同意活动须知
          </el-checkbox>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" native-type="submit">提交报名</el-button>
          <el-button native-type="button" @click="resetForm">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card v-if="submitted" shadow="never" class="result-card">
      <template #header>
        <span>提交结果</span>
      </template>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="姓名">{{ submitted.name }}</el-descriptions-item>
        <el-descriptions-item label="邮箱">{{ submitted.email }}</el-descriptions-item>
        <el-descriptions-item label="手机号">{{ submitted.phone }}</el-descriptions-item>
        <el-descriptions-item label="性别">{{ submitted.gender }}</el-descriptions-item>
        <el-descriptions-item label="城市">{{ submitted.city }}</el-descriptions-item>
        <el-descriptions-item label="岗位">{{ submitted.role }}</el-descriptions-item>
        <el-descriptions-item label="兴趣方向" :span="2">
          {{ submitted.interests.join('、') }}
        </el-descriptions-item>
        <el-descriptions-item label="出生日期">{{ submitted.birthday }}</el-descriptions-item>
        <el-descriptions-item label="到场时间">{{ submitted.arriveAt }}</el-descriptions-item>
        <el-descriptions-item label="同行人数">{{ submitted.companions }}</el-descriptions-item>
        <el-descriptions-item label="接收通知">
          {{ submitted.notify ? '是' : '否' }}
        </el-descriptions-item>
        <el-descriptions-item label="期待程度">{{ submitted.expectation }}</el-descriptions-item>
        <el-descriptions-item label="预算">{{ submitted.budget }}</el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">
          {{ submitted.note || '无' }}
        </el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>

<style scoped>
.form-scene {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 860px;
}

.form-card,
.result-card {
  border-radius: 12px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
