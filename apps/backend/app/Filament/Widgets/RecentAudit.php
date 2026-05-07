<?php

declare(strict_types=1);

namespace App\Filament\Widgets;

use App\Models\AuditLog;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget;
use Illuminate\Database\Eloquent\Builder;

class RecentAudit extends TableWidget
{
    protected int|string|array $columnSpan = 'full';

    public function table(Table $table): Table
    {
        return $table
            ->heading('Recent audit events')
            ->query(fn (): Builder => AuditLog::query()->with('actor')->latest()->limit(20))
            ->columns([
                TextColumn::make('created_at')
                    ->dateTime(),
                TextColumn::make('actor.email')
                    ->label('Actor')
                    ->placeholder('System'),
                TextColumn::make('action'),
                TextColumn::make('resource_type')
                    ->toggleable(),
            ])
            ->paginated(false);
    }
}
