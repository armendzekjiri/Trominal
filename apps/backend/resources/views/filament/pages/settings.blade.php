<x-filament-panels::page>
    @php($settings = $this->settings())

    <x-filament::section>
        <dl class="grid gap-6 md:grid-cols-2">
            <div>
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Instance name</dt>
                <dd class="mt-1 text-sm text-gray-950 dark:text-white">{{ $settings['instance_name'] }}</dd>
            </div>
            <div>
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Registration mode</dt>
                <dd class="mt-1 text-sm text-gray-950 dark:text-white">{{ ucfirst($settings['mode']) }}</dd>
            </div>
            <div>
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Registration open</dt>
                <dd class="mt-1 text-sm text-gray-950 dark:text-white">{{ $settings['open'] ? 'Yes' : 'No' }}</dd>
            </div>
            <div>
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Web SSH enabled</dt>
                <dd class="mt-1 text-sm text-gray-950 dark:text-white">{{ $settings['web_ssh_enabled'] ? 'Yes' : 'No' }}</dd>
            </div>
        </dl>
    </x-filament::section>
</x-filament-panels::page>
