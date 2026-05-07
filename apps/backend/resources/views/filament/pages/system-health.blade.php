<x-filament-panels::page>
    @php($health = $this->health())

    <x-filament::section>
        <dl class="grid gap-6 md:grid-cols-2">
            <div>
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Database</dt>
                <dd class="mt-1 text-sm text-gray-950 dark:text-white">{{ $health['database'] ? 'Healthy' : 'Unavailable' }}</dd>
            </div>
            <div>
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Redis</dt>
                <dd class="mt-1 text-sm text-gray-950 dark:text-white">{{ $health['redis'] ? 'Healthy' : 'Unavailable' }}</dd>
            </div>
            <div>
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Queue connection</dt>
                <dd class="mt-1 text-sm text-gray-950 dark:text-white">{{ $health['queue_connection'] }}</dd>
            </div>
            <div>
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Cache store</dt>
                <dd class="mt-1 text-sm text-gray-950 dark:text-white">{{ $health['cache_store'] }}</dd>
            </div>
            <div>
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Environment</dt>
                <dd class="mt-1 text-sm text-gray-950 dark:text-white">{{ $health['app_env'] }}</dd>
            </div>
        </dl>
    </x-filament::section>
</x-filament-panels::page>
