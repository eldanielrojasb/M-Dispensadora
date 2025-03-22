export interface FirebaseAdapterCredentials {
    databaseURL: string;
    pathPrivateKeyJson: string
}

export interface HistoryRow {
    id: number
    ref: string
    keyword: string | null
    answer: string
    refSerialize: string
    phone: string
    options: string
    created_at: Date
}
