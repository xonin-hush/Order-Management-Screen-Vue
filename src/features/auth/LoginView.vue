<script setup lang="ts">
import { computed, inject, nextTick, ref, useTemplateRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { revalidateLogic, useForm } from '@tanstack/vue-form'
import type { VBtn } from 'vuetify/components'
import { mdiEyeOffOutline, mdiEyeOutline } from '@mdi/js'
import type { z } from 'zod'
import { errorMessage, isApiError } from '@/api/errors'
import BrandMark from '@/components/layout/BrandMark.vue'
import {
  bindField,
  clearServerError,
  clearServerErrors,
  setServerError,
  submitForm,
} from '@/lib/form-field'
import { safeRedirect } from '@/lib/navigation'
import { demoAccountsKey } from './demo-accounts'
import { signInSchema } from './schema'
import { useSessionStore } from './session.store'
import type { DemoAccount } from './types'

const session = useSessionStore()
const router = useRouter()
const route = useRoute()
const demoAccounts = inject(demoAccountsKey, [])

const form = useForm({
  defaultValues: { email: '', password: '' },
  // Checked on the first submit, then as the user types.
  validationLogic: revalidateLogic(),
  validators: { onDynamic: signInSchema },
  listeners: { onChange: clearServerError },
  onSubmit: ({ value }) => signIn(signInSchema.parse(value)),
  onSubmitInvalid: focusFirstError,
})
const submitting = form.useSelector((state) => state.isSubmitting)
const formError = ref<string | null>(null)
const showPassword = ref(false)

const sessionExpired = computed(() => route.query.reason === 'expired' && !formError.value)

const formRef = useTemplateRef<HTMLFormElement>('formElement')
const submitRef = useTemplateRef<VBtn>('submitButton')

function focusFirstError() {
  void nextTick(() => {
    formRef.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  })
}

function onSubmit() {
  if (submitting.value) return
  formError.value = null
  void submitForm(form)
}

async function signIn(credentials: z.output<typeof signInSchema>) {
  try {
    await session.signIn(credentials)
    await router.replace(safeRedirect(route.query.redirect) ?? { name: 'orders' })
  } catch (error) {
    if (isApiError(error, 'validation')) {
      for (const name of ['email', 'password'] as const) {
        setServerError(form, name, error.fieldErrors[name])
      }
    }
    formError.value = errorMessage(error)
  }
}

function useDemoAccount(account: DemoAccount) {
  form.setFieldValue('email', account.email)
  form.setFieldValue('password', account.password)
  clearServerErrors(form)
  formError.value = null
  // One more Enter signs in.
  ;(submitRef.value?.$el as HTMLElement | undefined)?.focus()
}

const roleLabel = (role: string) => role.charAt(0).toUpperCase() + role.slice(1)
</script>

<template>
  <v-main>
    <div class="centered-page">
      <div class="w-100 sign-in">
        <div class="d-flex flex-column align-center text-center mb-8">
          <BrandMark :size="44" />
          <h1 tabindex="-1" class="mt-5 text-headline-small font-weight-semibold">
            Sign in to OrderDesk
          </h1>
          <p class="mt-1 text-body-medium text-medium-emphasis">
            Search, review and update customer orders.
          </p>
        </div>

        <v-card class="pa-6 pa-sm-8">
          <v-alert v-if="sessionExpired" type="warning" class="mb-5">
            Your session has expired. Please sign in again.
          </v-alert>
          <v-alert v-if="formError" type="error" class="mb-5">{{ formError }}</v-alert>

          <form
            ref="formElement"
            novalidate
            class="d-flex flex-column ga-5"
            @submit.prevent="onSubmit"
          >
            <form.Field v-slot="{ field }" name="email">
              <v-text-field
                v-bind="bindField(field)"
                required
                label="Email"
                type="email"
                autocomplete="username"
                autocapitalize="none"
                spellcheck="false"
              />
            </form.Field>
            <form.Field v-slot="{ field }" name="password">
              <v-text-field
                v-bind="bindField(field)"
                required
                label="Password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
              >
                <template #append-inner>
                  <v-btn
                    :icon="showPassword ? mdiEyeOffOutline : mdiEyeOutline"
                    variant="text"
                    size="small"
                    density="comfortable"
                    aria-label="Show password"
                    :aria-pressed="showPassword"
                    @click="showPassword = !showPassword"
                  />
                </template>
              </v-text-field>
            </form.Field>
            <v-btn
              ref="submitButton"
              type="submit"
              variant="flat"
              color="primary"
              size="large"
              block
              :loading="submitting"
            >
              {{ submitting ? 'Signing in…' : 'Sign in' }}
            </v-btn>
          </form>
        </v-card>

        <section
          v-if="demoAccounts.length"
          aria-labelledby="demo-accounts-heading"
          class="mt-6 pa-4 border border-dashed rounded-lg"
        >
          <h2 id="demo-accounts-heading" class="section-title">Demo accounts</h2>
          <p class="mt-1 text-body-small text-medium-emphasis">Pick a role to fill in the form.</p>
          <ul class="mt-3 d-flex flex-column ga-2">
            <li v-for="account in demoAccounts" :key="account.email">
              <v-btn
                block
                variant="text"
                border
                class="demo-account"
                :aria-label="`${roleLabel(account.role)}, ${account.email}`"
                @click="useDemoAccount(account)"
              >
                <span class="font-weight-medium">{{ roleLabel(account.role) }}</span>
                <span class="text-medium-emphasis text-truncate">{{ account.email }}</span>
              </v-btn>
            </li>
          </ul>
          <p class="mt-3 text-body-small text-medium-emphasis">
            Password for every account:
            <code>{{ demoAccounts[0]?.password }}</code>
          </p>
        </section>
      </div>
    </div>
  </v-main>
</template>

<style scoped>
.sign-in {
  max-width: 24rem;
}

/* Role on the left, email on the right. */
.demo-account :deep(.v-btn__content) {
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-width: 0;
}
</style>
