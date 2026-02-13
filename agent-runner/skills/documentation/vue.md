&#x3C;script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'const props = defineProps&#x3C;{
title: string
count?: number
}>()const emit = defineEmits&#x3C;{
update: [value: string]
}>()const model = defineModel&#x3C;string>()const doubled = computed(() => (props.count ?? 0) * 2)watch(() => props.title, (newVal) => {
console.log('Title changed:', newVal)
})onMounted(() => {
console.log('Component mounted')
})
&#x3C;/script>&#x3C;template>
&#x3C;div>{{ title }} - {{ doubled }}&#x3C;/div>
&#x3C;/template>